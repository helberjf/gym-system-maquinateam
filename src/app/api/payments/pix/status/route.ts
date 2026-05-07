import { z } from "zod";
import {
  handleRouteError,
  successResponse,
} from "@/lib/errors";
import { getOptionalSession } from "@/lib/auth/session";
import { getPixCheckoutStatus } from "@/lib/payments/pix";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  pixStatusLimiter,
} from "@/lib/rate-limit";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";

const pixStatusQuerySchema = z.object({
  payment: z.string().trim().cuid("ID de pagamento invalido."),
});

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const { payment } = parseSearchParams(
      new URL(request.url).searchParams,
      pixStatusQuerySchema,
    );
    const rateLimit = await enforceRateLimit({
      request,
      limiter: pixStatusLimiter,
      keyParts: [payment],
    });
    rateLimitHeaders = rateLimit.headers;

    const session = await getOptionalSession();

    const status = await getPixCheckoutStatus({
      checkoutPaymentId: payment,
      userId: session?.user?.id ?? null,
    });

    return attachRateLimitHeaders(successResponse(status), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "pix payment status route",
      headers: rateLimitHeaders,
    });
  }
}
