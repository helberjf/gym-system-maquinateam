import { captureException } from "@/lib/observability/capture";
import {
  enqueueWhatsAppSend,
  shouldEnqueueWhatsApp,
} from "@/lib/messaging/queue";

type SendTextInput = {
  to: string;
  message: string;
};

type SendResult = {
  ok: boolean;
  messageId?: string;
  provider: "z-api" | "noop";
  error?: string;
};

const DDD_MIN_LENGTH = 10;
const DDD_MAX_LENGTH = 13;

function isZApiConfigured() {
  return Boolean(
    process.env.ZAPI_INSTANCE_ID?.trim() &&
      process.env.ZAPI_INSTANCE_TOKEN?.trim(),
  );
}

export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < DDD_MIN_LENGTH) {
    return null;
  }

  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (
    withCountry.length < DDD_MIN_LENGTH ||
    withCountry.length > DDD_MAX_LENGTH + 2
  ) {
    return null;
  }
  return withCountry;
}

export async function sendWhatsAppText(
  input: SendTextInput,
): Promise<SendResult> {
  const normalized = normalizeBrazilianPhone(input.to);
  if (!normalized) {
    return {
      ok: false,
      provider: isZApiConfigured() ? "z-api" : "noop",
      error: "invalid_phone",
    };
  }

  if (!isZApiConfigured()) {
    return {
      ok: true,
      provider: "noop",
    };
  }

  const instanceId = process.env.ZAPI_INSTANCE_ID!.trim();
  const instanceToken = process.env.ZAPI_INSTANCE_TOKEN!.trim();
  const clientToken = process.env.ZAPI_CLIENT_TOKEN?.trim();

  const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({
        phone: normalized,
        message: input.message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      captureException(
        new Error(`Z-API send failed: ${response.status} ${errorText}`),
        {
          source: "messaging whatsapp",
          extras: { phone: normalized, status: response.status },
        },
      );
      return {
        ok: false,
        provider: "z-api",
        error: `status_${response.status}`,
      };
    }

    const data = (await response.json().catch(() => null)) as
      | { zaapId?: string; messageId?: string }
      | null;

    return {
      ok: true,
      provider: "z-api",
      messageId: data?.messageId ?? data?.zaapId,
    };
  } catch (error) {
    captureException(error, {
      source: "messaging whatsapp",
      extras: { phone: normalized },
    });
    return {
      ok: false,
      provider: "z-api",
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function sendWhatsAppTextSafely(input: SendTextInput) {
  if (shouldEnqueueWhatsApp()) {
    try {
      const enqueued = await enqueueWhatsAppSend({
        to: input.to,
        message: input.message,
      });
      if (enqueued.ok && "queued" in enqueued && enqueued.queued) {
        return {
          ok: true,
          provider: "z-api",
          messageId: enqueued.messageId,
        } satisfies SendResult;
      }
    } catch (error) {
      captureException(error, {
        source: "messaging whatsapp queue",
      });
    }
  }

  try {
    return await sendWhatsAppText(input);
  } catch (error) {
    captureException(error, {
      source: "messaging whatsapp safe",
    });
    return { ok: false, provider: "noop", error: "safe_catch" } satisfies SendResult;
  }
}
