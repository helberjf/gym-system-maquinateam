import { deactivateTeacher, updateTeacher } from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, updateTeacherSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTeachers");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateTeacherSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "teachers", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateTeacher(
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
        teacherId: result.id,
        registrationNumber: result.registrationNumber,
        message: "Professor atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "teachers update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageTeachers");
    const { id } = await context.params;
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "teachers", "delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await deactivateTeacher(id, {
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
        message: "Professor inativado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "teachers delete route",
      headers: rateLimitHeaders,
    });
  }
}
