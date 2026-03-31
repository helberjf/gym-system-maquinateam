import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { duplicateTrainingTemplate } from "@/lib/training/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTrainings");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-template-duplicate", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await duplicateTrainingTemplate(id, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          templateId: result.id,
          message: "Modelo duplicado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training templates duplicate route",
      headers: rateLimitHeaders,
    });
  }
}
