import { auth } from "@/auth";
import { handleRouteError, successResponse, UnauthorizedError } from "@/lib/errors";
import { deleteSubscription } from "@/lib/push/service";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, pushUnsubscribeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id || session.user.isActive === false) {
      throw new UnauthorizedError("Nao autorizado.");
    }

    const input = await parseJsonBody(request, pushUnsubscribeSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "push-unsubscribe"],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await deleteSubscription(input.endpoint, session.user.id);

    return attachRateLimitHeaders(
      successResponse({ removed: result.count }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "push unsubscribe route",
      headers: rateLimitHeaders,
    });
  }
}
