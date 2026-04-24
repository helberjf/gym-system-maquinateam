import {
  deletePhysicalAssessment,
  getPhysicalAssessment,
  updatePhysicalAssessment,
} from "@/lib/academy/assessments";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  parseJsonBody,
  updatePhysicalAssessmentSchema,
} from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewPhysicalAssessments");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "assessment-view", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const assessment = await getPhysicalAssessment(id, viewer);

    return attachRateLimitHeaders(
      successResponse({ assessment }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "physical-assessment view route",
      headers: rateLimitHeaders,
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("managePhysicalAssessments");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updatePhysicalAssessmentSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "assessment-update", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const updated = await updatePhysicalAssessment(
      { ...input, id },
      { viewer, request },
    );

    return attachRateLimitHeaders(
      successResponse({
        assessmentId: updated.id,
        message: "Avaliacao atualizada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "physical-assessment update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("managePhysicalAssessments");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "assessment-delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await deletePhysicalAssessment(id, { viewer, request });

    return attachRateLimitHeaders(
      successResponse({ message: "Avaliacao removida com sucesso." }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "physical-assessment delete route",
      headers: rateLimitHeaders,
    });
  }
}
