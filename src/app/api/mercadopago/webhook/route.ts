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

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: ["mercadopago-webhook"],
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
