import {
  createPhysicalAssessment,
  listPhysicalAssessments,
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
  createPhysicalAssessmentSchema,
  parseJsonBody,
  parseSearchParams,
  physicalAssessmentFiltersSchema,
} from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewPhysicalAssessments");
    const url = new URL(request.url);
    const filters = parseSearchParams(
      url.searchParams,
      physicalAssessmentFiltersSchema,
    );
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "assessments-list", filters.studentId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await listPhysicalAssessments(filters, viewer);

    return attachRateLimitHeaders(
      successResponse(result),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "physical-assessments list route",
      headers: rateLimitHeaders,
    });
  }
}

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("managePhysicalAssessments");
    const input = await parseJsonBody(request, createPhysicalAssessmentSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "assessments-create", input.studentId],
    });
    rateLimitHeaders = rateLimit.headers;

    const created = await createPhysicalAssessment(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          assessmentId: created.id,
          message: "Avaliacao registrada com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "physical-assessments create route",
      headers: rateLimitHeaders,
    });
  }
}
