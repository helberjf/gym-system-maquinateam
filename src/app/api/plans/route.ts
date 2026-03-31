import { createPlan } from "@/lib/billing/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  adminLimiter,
  attachRateLimitHeaders,
  enforceRateLimit,
} from "@/lib/rate-limit";
import { createPlanSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("managePlans");
    const input = await parseJsonBody(request, createPlanSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id, "plans", input.slug ?? input.name],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createPlan(input, {
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
          planId: result.id,
          message: "Plano criado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "plans create route",
      headers: rateLimitHeaders,
    });
  }
}
