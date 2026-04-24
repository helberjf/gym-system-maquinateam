import { Client } from "@upstash/qstash";
import { captureException } from "@/lib/observability/capture";

type EnqueueWhatsAppInput = {
  to: string;
  message: string;
  delaySeconds?: number;
};

type EnqueueResult =
  | { ok: true; queued: true; messageId: string }
  | { ok: true; queued: false; reason: "not_configured" }
  | { ok: false; error: string };

function getPublicAppUrl(): string | null {
  const explicit = process.env.QSTASH_TARGET_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, "");
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }
  return null;
}

function isQstashConfigured() {
  return Boolean(process.env.QSTASH_TOKEN?.trim() && getPublicAppUrl());
}

let cachedClient: Client | null = null;
function getClient(): Client | null {
  if (!isQstashConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return cachedClient;
}

export async function enqueueWhatsAppSend(
  input: EnqueueWhatsAppInput,
): Promise<EnqueueResult> {
  const client = getClient();
  if (!client) {
    return { ok: true, queued: false, reason: "not_configured" };
  }

  const baseUrl = getPublicAppUrl();
  if (!baseUrl) {
    return { ok: true, queued: false, reason: "not_configured" };
  }

  try {
    const response = await client.publishJSON({
      url: `${baseUrl}/api/queue/whatsapp/send`,
      body: {
        to: input.to,
        message: input.message,
      },
      delay: input.delaySeconds,
      retries: 3,
    });
    return {
      ok: true,
      queued: true,
      messageId: response.messageId,
    };
  } catch (error) {
    captureException(error, { source: "qstash enqueue whatsapp" });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export function shouldEnqueueWhatsApp() {
  return isQstashConfigured();
}
