import { resendVerificationEmail } from "@/lib/auth/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  resendVerificationLimiter,
} from "@/lib/rate-limit";
import { resendVerificationSchema } from "@/lib/validators/auth";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const input = await parseJsonBody(request, resendVerificationSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: resendVerificationLimiter,
      keyParts: [input.email],
    });
    rateLimitHeaders = rateLimit.headers;
    const result = await resendVerificationEmail(input, { request });

    return attachRateLimitHeaders(successResponse(result), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "resend verification route",
      headers: rateLimitHeaders,
    });
  }
}
