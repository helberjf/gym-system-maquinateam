import {
  getViewerContextFromSession,
} from "@/lib/academy/access";
import { checkInStudent } from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { checkInSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAttendance");
    const input = await parseJsonBody(request, checkInSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "attendance-check-in", input.studentProfileId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await checkInStudent(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          attendanceId: result.id,
          message: "Check-in registrado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "attendance check-in route",
      headers: rateLimitHeaders,
    });
  }
}
