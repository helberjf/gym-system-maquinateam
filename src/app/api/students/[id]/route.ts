import { deactivateStudent, updateStudent } from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, updateStudentSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageStudents");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateStudentSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "students", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateStudent(
      {
        ...input,
        id,
      },
      {
        viewer: {
          userId: session.user.id,
          role: session.user.role,
          studentProfileId: null,
          teacherProfileId: null,
        },
        request,
      },
    );

    return attachRateLimitHeaders(
      successResponse({
        studentId: result.id,
        registrationNumber: result.registrationNumber,
        message: "Aluno atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "students update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageStudents");
    const { id } = await context.params;
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "students", "delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await deactivateStudent(id, {
      viewer: {
        userId: session.user.id,
        role: session.user.role,
        studentProfileId: null,
        teacherProfileId: null,
      },
      request,
    });

    return attachRateLimitHeaders(
      successResponse({
        message: "Aluno inativado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "students delete route",
      headers: rateLimitHeaders,
    });
  }
}
