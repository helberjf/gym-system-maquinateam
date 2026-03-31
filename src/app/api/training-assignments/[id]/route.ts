import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { updateTrainingAssignment } from "@/lib/training/service";
import { updateTrainingAssignmentSchema, parseJsonBody } from "@/lib/validators";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiRole([
      UserRole.ADMIN,
      UserRole.PROFESSOR,
      UserRole.ALUNO,
    ]);
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateTrainingAssignmentSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "training-assignment-update", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateTrainingAssignment(
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
        assignmentId: result.id,
        message: "Treino atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "training assignments update route",
      headers: rateLimitHeaders,
    });
  }
}
