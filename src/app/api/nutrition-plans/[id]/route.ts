import { getViewerContextFromSession } from "@/lib/academy/access";
import {
  deleteNutritionPlan,
  getNutritionPlan,
  updateNutritionPlan,
} from "@/lib/nutrition/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  parseJsonBody,
  updateNutritionPlanSchema,
} from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewNutritionPlans");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "nutrition-view", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const plan = await getNutritionPlan(id, viewer);

    return attachRateLimitHeaders(
      successResponse({ plan }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "nutrition plan view route",
      headers: rateLimitHeaders,
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageNutritionPlans");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateNutritionPlanSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "nutrition-update", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const updated = await updateNutritionPlan(
      { ...input, id },
      { viewer, request },
    );

    return attachRateLimitHeaders(
      successResponse({
        nutritionPlanId: updated.id,
        message: "Plano alimentar atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "nutrition plan update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageNutritionPlans");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "nutrition-delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await deleteNutritionPlan(id, { viewer, request });

    return attachRateLimitHeaders(
      successResponse({ message: "Plano alimentar removido com sucesso." }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "nutrition plan delete route",
      headers: rateLimitHeaders,
    });
  }
}
