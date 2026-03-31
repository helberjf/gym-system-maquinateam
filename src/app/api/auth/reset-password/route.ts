import { resetPasswordWithToken } from "@/lib/auth/service";
import { BadRequestError, handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  resetPasswordLimiter,
} from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const input = await parseJsonBody(request, resetPasswordSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: resetPasswordLimiter,
      keyParts: [input.token],
    });
    rateLimitHeaders = rateLimit.headers;
    const result = await resetPasswordWithToken(input, { request });

    if (!result.ok) {
      throw new BadRequestError(result.message);
    }

    return attachRateLimitHeaders(successResponse(result), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "reset password route",
      headers: rateLimitHeaders,
    });
  }
}
