import { getViewerContextFromSession } from "@/lib/academy/access";
import {
  createNutritionPlan,
  listNutritionPlans,
} from "@/lib/nutrition/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  createNutritionPlanSchema,
  nutritionPlanFiltersSchema,
  parseJsonBody,
  parseSearchParams,
} from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewNutritionPlans");
    const url = new URL(request.url);
    const filters = parseSearchParams(
      url.searchParams,
      nutritionPlanFiltersSchema,
    );
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "nutrition-list", filters.studentId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await listNutritionPlans(filters, viewer);

    return attachRateLimitHeaders(
      successResponse(result),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "nutrition plans list route",
      headers: rateLimitHeaders,
    });
  }
}

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageNutritionPlans");
    const input = await parseJsonBody(request, createNutritionPlanSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "nutrition-create", input.studentId],
    });
    rateLimitHeaders = rateLimit.headers;

    const created = await createNutritionPlan(input, { viewer, request });

    return attachRateLimitHeaders(
      successResponse(
        {
          nutritionPlanId: created.id,
          message: "Plano alimentar registrado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "nutrition plans create route",
      headers: rateLimitHeaders,
    });
  }
}
