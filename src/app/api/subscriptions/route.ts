import { createSubscription } from "@/lib/billing/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createSubscriptionSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageSubscriptions");
    const input = await parseJsonBody(request, createSubscriptionSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "subscriptions", input.studentProfileId, input.planId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createSubscription(input, {
      viewer: {
        userId: session.user.id,
        role: session.user.role,
        studentProfileId: null,
        teacherProfileId: null,
      },
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          subscriptionId: result.id,
          message: "Assinatura criada com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "subscriptions create route",
      headers: rateLimitHeaders,
    });
  }
}
