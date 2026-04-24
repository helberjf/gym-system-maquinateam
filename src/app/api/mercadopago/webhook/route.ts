import { handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  parseMercadoPagoWebhookPayload,
  verifyMercadoPagoWebhookRequest,
} from "@/lib/payments/mercadopago";
import { processMercadoPagoPaymentWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";

function extractWebhookRateKey(request: Request) {
  try {
    const url = new URL(request.url);
    const candidate =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      url.searchParams.get("data_id");

    if (candidate && candidate.trim().length > 0) {
      return candidate.trim().slice(0, 64);
    }
  } catch {
    // ignore malformed URL; fall back to global key below
  }

  return "global";
}

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const rateKey = extractWebhookRateKey(request);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: ["mercadopago-webhook", rateKey],
    });
    rateLimitHeaders = rateLimit.headers;

    await verifyMercadoPagoWebhookRequest(request);
    const parsed = await parseMercadoPagoWebhookPayload(request);
    const result = await processMercadoPagoPaymentWebhook({
      eventType: parsed.eventType,
      payload: parsed.payload,
      providerKey: parsed.providerKey,
      providerObjectId: parsed.providerObjectId,
    });

    return attachRateLimitHeaders(successResponse(result), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "mercadopago webhook route",
      headers: rateLimitHeaders,
    });
  }
}
