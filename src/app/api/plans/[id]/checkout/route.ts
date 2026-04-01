import { requireApiPermission } from "@/lib/permissions";
import { createPlanCheckoutSession } from "@/lib/billing/self-service";
import { handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, selfServicePlanCheckoutSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteParams = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewPlans");
    const { id } = await params;
    const input = await parseJsonBody(request, selfServicePlanCheckoutSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "plan-checkout", id, input.paymentMethod],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createPlanCheckoutSession(id, input, {
      userId: session.user.id,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          subscriptionId: result.subscriptionId,
          redirectUrl: result.redirectUrl,
          reused: result.reused,
          message: result.reused
            ? "Link de pagamento recuperado."
            : "Checkout do plano iniciado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "plan checkout route",
      headers: rateLimitHeaders,
    });
  }
}
