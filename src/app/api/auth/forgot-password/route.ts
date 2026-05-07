import { after } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { logger, serializeError } from "@/lib/observability/logger";
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

    let deferredEmail: (() => Promise<void>) | null = null;
    const result = await requestPasswordReset(
      input,
      { request },
      { onEmailReady: (send) => { deferredEmail = send; } },
    );

    if (deferredEmail) {
      after(() =>
        (deferredEmail as () => Promise<void>)().catch((error) => {
          logger.error("auth.forgot_password.deferred_email_failed", {
            error: serializeError(error),
          });
        }),
      );
    }

    return attachRateLimitHeaders(successResponse(result), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "forgot password route",
      headers: rateLimitHeaders,
    });
  }
}
