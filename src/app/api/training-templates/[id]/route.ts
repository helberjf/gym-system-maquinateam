import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  archiveTrainingTemplate,
  updateTrainingTemplate,
} from "@/lib/training/service";
import { parseJsonBody, updateTrainingTemplateSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTrainings");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateTrainingTemplateSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-template", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateTrainingTemplate(
      {
        ...input,
        id,
      },
      {
        viewer,
        request,
      },
    );

    return attachRateLimitHeaders(
      successResponse({
        templateId: result.id,
        message: "Modelo de treino atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training templates update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTrainings");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-template-delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await archiveTrainingTemplate(id, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse({
        message: "Modelo de treino arquivado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training templates delete route",
      headers: rateLimitHeaders,
    });
  }
}
