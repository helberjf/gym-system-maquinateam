import { cancelSubscription, updateSubscription } from "@/lib/billing/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, updateSubscriptionSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageSubscriptions");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateSubscriptionSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "subscriptions", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateSubscription(
      {
        ...input,
        id,
      },
      {
        viewer: {
          userId: session.user.id,
          role: session.user.role,
          studentProfileId: null,
          teacherProfileId: null,
        },
        request,
      },
    );

    return attachRateLimitHeaders(
      successResponse({
        subscriptionId: result.id,
        message: "Assinatura atualizada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "subscriptions update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageSubscriptions");
    const { id } = await context.params;
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "subscriptions", "delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await cancelSubscription(id, {
      viewer: {
        userId: session.user.id,
        role: session.user.role,
        studentProfileId: null,
        teacherProfileId: null,
      },
      request,
    });

    return attachRateLimitHeaders(
      successResponse({
        message: "Assinatura cancelada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "subscriptions delete route",
      headers: rateLimitHeaders,
    });
  }
}
