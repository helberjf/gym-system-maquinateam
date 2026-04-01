import { PaymentStatus } from "@prisma/client";
import { ServiceUnavailableError } from "@/lib/errors";

type AbacatePayEnvelope<T> = {
  data?: T;
  error?: { message?: string } | string | null;
};

type AbacatePayPixCustomer = {
  name: string;
  cellphone: string;
  email: string;
  taxId: string;
};

export type AbacatePayPixData = {
  id?: string;
  amount?: number;
  status?: string;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

type CreateAbacatePayPixInput = {
  amountCents: number;
  description?: string;
  expiresInSeconds?: number;
  customer?: AbacatePayPixCustomer;
  metadata?: Record<string, unknown>;
};

const DEFAULT_ABACATEPAY_BASE_URL = "https://api.abacatepay.com";

function getAbacatePayBaseUrl() {
  const baseUrl =
    process.env.ABACATEPAY_BASE_URL?.trim() || DEFAULT_ABACATEPAY_BASE_URL;

  return baseUrl.replace(/\/+$/, "");
}

function getAbacatePayApiKey() {
  const apiKey = process.env.ABACATEPAY_API_KEY?.trim();

  if (!apiKey) {
    throw new ServiceUnavailableError(
      "O Pix da loja ainda nao esta configurado neste ambiente.",
    );
  }

  return apiKey;
}

function extractAbacatePayError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const envelope = payload as { error?: unknown };
  const { error } = envelope;

  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

async function abacatePayRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getAbacatePayBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getAbacatePayApiKey()}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | AbacatePayEnvelope<T>
    | null;

  if (!response.ok) {
    throw new ServiceUnavailableError(
      extractAbacatePayError(payload) ??
        `Erro ao comunicar com a AbacatePay (${response.status}).`,
    );
  }

  if (!payload?.data) {
    throw new ServiceUnavailableError("Resposta invalida da AbacatePay.");
  }

  return payload.data;
}

export function formatAbacatePayCellphone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

export function mapAbacatePayPixStatus(status?: string | null) {
  const normalizedStatus = status?.trim().toUpperCase() ?? "";

  if (["PAID", "APPROVED", "SUCCEEDED", "COMPLETED"].includes(normalizedStatus)) {
    return PaymentStatus.PAID;
  }

  if (normalizedStatus === "REFUNDED") {
    return PaymentStatus.REFUNDED;
  }

  if (["CANCELLED", "CANCELED", "EXPIRED"].includes(normalizedStatus)) {
    return PaymentStatus.CANCELLED;
  }

  if (["FAILED", "ERROR"].includes(normalizedStatus)) {
    return PaymentStatus.FAILED;
  }

  return PaymentStatus.PENDING;
}

export async function createAbacatePayPixQrCode(
  input: CreateAbacatePayPixInput,
) {
  return abacatePayRequest<AbacatePayPixData>("/v1/pixQrCode/create", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountCents,
      expiresIn: input.expiresInSeconds ?? 3600,
      ...(input.description
        ? { description: input.description.slice(0, 140) }
        : {}),
      ...(input.customer ? { customer: input.customer } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }),
  });
}

export async function checkAbacatePayPixQrCode(id: string) {
  const params = new URLSearchParams({ id });

  return abacatePayRequest<AbacatePayPixData>(
    `/v1/pixQrCode/check?${params.toString()}`,
    {
      method: "GET",
    },
  );
}
