import { after } from "next/server";
import { registerStudent } from "@/lib/auth/service";
import { ConflictError, handleRouteError, successResponse } from "@/lib/errors";
import { logger, serializeError } from "@/lib/observability/logger";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  registerLimiter,
} from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators/auth";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const input = await parseJsonBody(request, registerSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: registerLimiter,
      keyParts: [input.email],
    });
    rateLimitHeaders = rateLimit.headers;

    let deferredEmail: (() => Promise<void>) | null = null;
    const result = await registerStudent(
      input,
      { request },
      { onEmailReady: (send) => { deferredEmail = send; } },
    );

    if (deferredEmail) {
      after(() =>
        (deferredEmail as () => Promise<void>)().catch((error) => {
          logger.error("auth.register.deferred_email_failed", {
            error: serializeError(error),
          });
        }),
      );
    }

    if (!result.ok) {
      throw new ConflictError(result.message);
    }

    return attachRateLimitHeaders(
      successResponse(
        {
          ok: true,
          email: result.email,
          emailSent: result.emailSent,
          message: result.message,
        },
        { status: result.status },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "register route",
      headers: rateLimitHeaders,
    });
  }
}
