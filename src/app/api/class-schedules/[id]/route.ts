import {
  archiveClassSchedule,
  updateClassSchedule,
} from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, updateClassScheduleSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageClassSchedules");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateClassScheduleSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "class-schedules", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateClassSchedule(
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
        classScheduleId: result.id,
        message: "Turma atualizada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "class schedules update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageClassSchedules");
    const { id } = await context.params;
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "class-schedules", "delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await archiveClassSchedule(id, {
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
        message: "Turma arquivada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "class schedules delete route",
      headers: rateLimitHeaders,
    });
  }
}
