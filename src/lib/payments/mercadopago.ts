import crypto from "crypto";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import {
  BadRequestError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "@/lib/errors";
import { getAppUrl } from "@/lib/app-url";

type MercadoPagoPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "BRL";
};

type MercadoPagoPayer = {
  name?: string;
  surname?: string;
  email?: string;
  phone?: {
    area_code: string;
    number: string;
  };
  identification?: {
    type: "CPF";
    number: string;
  };
  address?: {
    zip_code: string;
    street_name: string;
    street_number: number;
  };
};

type MercadoPagoPreferenceInput = {
  items: MercadoPagoPreferenceItem[];
  externalReference: string;
  payer?: MercadoPagoPayer;
  notificationUrl?: string;
  successUrl: string;
  pendingUrl?: string;
  failureUrl: string;
  statementDescriptor?: string;
  metadata?: Record<string, unknown>;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
};

export type MercadoPagoPaymentDetails = {
  id?: number | string;
  status?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  external_reference?: string;
  message?: string;
};

type MercadoPagoWebhookBody = {
  action?: string;
  type?: string;
  live_mode?: boolean;
  data?: {
    id?: string | number;
  };
  id?: string | number;
};

type SignatureParts = {
  ts: string;
  v1: string;
} | null;

function getAccessToken() {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new ServiceUnavailableError(
      "O checkout online ainda nao esta configurado neste ambiente.",
    );
  }

  return accessToken;
}

function normalizeStatementDescriptor(value?: string | null) {
  const normalized = (value ?? "MAQUINATEAM")
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 13)
    .toUpperCase();

  return normalized || "MAQUINATEAM";
}

function getInstallmentsLimit() {
  const rawValue = Number(process.env.MP_MAX_INSTALLMENTS ?? 6);

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 6;
  }

  return Math.floor(rawValue);
}

function parseMercadoPagoSignature(headerValue: string | null): SignatureParts {
  if (!headerValue) {
    return null;
  }

  const parts = headerValue.split(",").map((part) => part.trim());
  const tsPart = parts.find((part) => part.startsWith("ts="));
  const v1Part = parts.find((part) => part.startsWith("v1="));

  if (!tsPart || !v1Part) {
    return null;
  }

  const ts = tsPart.replace("ts=", "");
  const v1 = v1Part.replace("v1=", "");

  if (!ts || !v1) {
    return null;
  }

  return { ts, v1 };
}

function timingSafeEqualHex(a: string, b: string) {
  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

function normalizeSignatureId(id: string) {
  return /^[a-z0-9]+$/i.test(id) ? id.toLowerCase() : id;
}

export function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export function getMercadoPagoWebhookUrl(origin?: string | null) {
  return (
    process.env.MP_WEBHOOK_URL?.trim() ??
    `${getAppUrl(origin)}/api/mercadopago/webhook`
  );
}

export function buildMercadoPagoReturnUrls(input: {
  successPath: string;
  failurePath: string;
  origin?: string | null;
}) {
  const baseUrl = getAppUrl(input.origin);

  return {
    successUrl: `${baseUrl}${input.successPath}`,
    pendingUrl: `${baseUrl}${input.successPath}`,
    failureUrl: `${baseUrl}${input.failurePath}`,
  };
}

export async function createMercadoPagoPreference(
  input: MercadoPagoPreferenceInput,
) {
  const accessToken = getAccessToken();
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items,
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      payer: input.payer,
      metadata: input.metadata,
      back_urls: {
        success: input.successUrl,
        pending: input.pendingUrl ?? input.successUrl,
        failure: input.failureUrl,
      },
      payment_methods: {
        excluded_payment_types: [],
        installments: getInstallmentsLimit(),
      },
      statement_descriptor: normalizeStatementDescriptor(
        input.statementDescriptor,
      ),
      auto_return: "approved",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | MercadoPagoPreferenceResponse
    | null;

  if (!response.ok) {
    throw new ServiceUnavailableError(
      payload?.message ?? "Nao foi possivel iniciar o checkout online.",
    );
  }

  const checkoutUrl = payload?.init_point ?? payload?.sandbox_init_point ?? null;

  if (!payload?.id || !checkoutUrl) {
    throw new ServiceUnavailableError(
      "O Mercado Pago nao retornou um link valido de pagamento.",
    );
  }

  return {
    preferenceId: payload.id,
    checkoutUrl,
    rawPayload: payload,
  };
}

export async function fetchMercadoPagoPaymentDetails(paymentId: string) {
  const accessToken = getAccessToken();
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | MercadoPagoPaymentDetails
    | null;

  if (!response.ok || !payload) {
    throw new ServiceUnavailableError(
      payload?.message ?? "Nao foi possivel consultar o pagamento no gateway.",
    );
  }

  return payload;
}

export function mapMercadoPagoPaymentStatus(status?: string | null) {
  switch (status) {
    case "approved":
      return PaymentStatus.PAID;
    case "pending":
    case "in_process":
    case "authorized":
      return PaymentStatus.PENDING;
    case "cancelled":
      return PaymentStatus.CANCELLED;
    case "refunded":
    case "charged_back":
      return PaymentStatus.REFUNDED;
    default:
      return PaymentStatus.FAILED;
  }
}

export function mapMercadoPagoPaymentMethod(paymentTypeId?: string | null) {
  switch (paymentTypeId) {
    case "pix":
      return PaymentMethod.PIX;
    case "debit_card":
      return PaymentMethod.DEBIT_CARD;
    case "ticket":
    case "bolbradesco":
    case "atm":
      return PaymentMethod.BOLETO;
    case "bank_transfer":
      return PaymentMethod.BANK_TRANSFER;
    case "credit_card":
    default:
      return PaymentMethod.CREDIT_CARD;
  }
}

export async function verifyMercadoPagoWebhookRequest(request: Request) {
  const allowlistRaw = process.env.MP_WEBHOOK_ALLOWED_IPS?.trim();

  if (allowlistRaw) {
    const allowlist = allowlistRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip")?.trim() ??
      request.headers.get("cf-connecting-ip")?.trim() ??
      null;

    if (!clientIp || !allowlist.includes(clientIp)) {
      throw new UnauthorizedError("IP do webhook nao autorizado.");
    }
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "mercadopago webhook: MP_WEBHOOK_ALLOWED_IPS nao configurado — qualquer IP pode chamar este endpoint. Configure a allowlist no painel do Vercel.",
    );
  }

  const webhookSecret = process.env.MP_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedError(
        "MP_WEBHOOK_SECRET nao configurado em producao.",
      );
    }
    return;
  }

  const url = new URL(request.url);
  const signatureHeader = request.headers.get("x-signature");
  const requestIdHeader = request.headers.get("x-request-id");
  const parsedSignature = parseMercadoPagoSignature(signatureHeader);
  const idFromUrl =
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    url.searchParams.get("data_id");

  if (!parsedSignature || !requestIdHeader || !idFromUrl) {
    throw new UnauthorizedError("Assinatura do webhook invalida.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestampSeconds = Number(parsedSignature.ts);

  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > 5 * 60
  ) {
    throw new UnauthorizedError("Assinatura do webhook expirada.");
  }

  const normalizedId = normalizeSignatureId(idFromUrl);
  const signatureTemplate = `id:${normalizedId};request-id:${requestIdHeader};ts:${parsedSignature.ts};`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signatureTemplate)
    .digest("hex");

  if (!timingSafeEqualHex(expectedSignature, parsedSignature.v1)) {
    throw new UnauthorizedError("Assinatura do webhook invalida.");
  }
}

export async function refundMercadoPagoPayment(
  paymentId: string,
  amountCents?: number,
) {
  const accessToken = getAccessToken();
  const body = amountCents !== undefined ? { amount: amountCents / 100 } : undefined;

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    id?: number;
    payment_id?: string;
    amount?: number;
    status?: string;
    message?: string;
  } | null;

  if (!response.ok || !payload) {
    throw new ServiceUnavailableError(
      payload?.message ?? "Nao foi possivel processar o estorno no gateway.",
    );
  }

  return payload;
}

export async function parseMercadoPagoWebhookPayload(request: Request) {
  let payload: MercadoPagoWebhookBody = {};

  try {
    payload = (await request.json()) as MercadoPagoWebhookBody;
  } catch {
    payload = {};
  }

  const url = new URL(request.url);
  const paymentId =
    payload.data?.id ??
    payload.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    url.searchParams.get("data_id");

  if (!paymentId) {
    throw new BadRequestError("Webhook sem identificador de pagamento.");
  }

  return {
    payload,
    providerObjectId: String(paymentId),
    providerKey: `mercado_pago:${String(paymentId)}`,
    eventType: payload.action ?? payload.type ?? "payment",
  };
}
