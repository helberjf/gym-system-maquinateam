import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createTrainingTemplate } from "@/lib/training/service";
import { createTrainingTemplateSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTrainings");
    const input = await parseJsonBody(request, createTrainingTemplateSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-template", input.slug ?? input.name],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createTrainingTemplate(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          templateId: result.id,
          message: "Modelo de treino criado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training templates create route",
      headers: rateLimitHeaders,
    });
  }
}
