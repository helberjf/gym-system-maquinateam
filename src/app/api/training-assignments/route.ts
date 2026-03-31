import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createTrainingAssignments } from "@/lib/training/service";
import { createTrainingAssignmentSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTrainings");
    const input = await parseJsonBody(request, createTrainingAssignmentSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-assignment", input.trainingTemplateId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createTrainingAssignments(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          assignmentIds: result.map((assignment) => assignment.id),
          message: "Treino atribuido com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training assignments create route",
      headers: rateLimitHeaders,
    });
  }
}
