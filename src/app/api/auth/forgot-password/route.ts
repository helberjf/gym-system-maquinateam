import { requestPasswordReset } from "@/lib/auth/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  forgotPasswordLimiter,
} from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const input = await parseJsonBody(request, forgotPasswordSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: forgotPasswordLimiter,
      keyParts: [input.email],
    });
    rateLimitHeaders = rateLimit.headers;
    const result = await requestPasswordReset(input, { request });

    return attachRateLimitHeaders(successResponse(result), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "forgot password route",
      headers: rateLimitHeaders,
    });
  }
}
