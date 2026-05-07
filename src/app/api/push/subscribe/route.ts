import { auth } from "@/auth";
import { handleRouteError, successResponse, UnauthorizedError } from "@/lib/errors";
import { saveSubscription } from "@/lib/push/service";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, pushSubscribeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id || session.user.isActive === false) {
      throw new UnauthorizedError("Nao autorizado.");
    }

    const input = await parseJsonBody(request, pushSubscribeSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "push-subscribe"],
    });
    rateLimitHeaders = rateLimit.headers;

    const subscription = await saveSubscription({
      userId: session.user.id,
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent: request.headers.get("user-agent"),
    });

    return attachRateLimitHeaders(
      successResponse({ id: subscription.id, message: "Inscricao salva." }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "push subscribe route",
      headers: rateLimitHeaders,
    });
  }
}
