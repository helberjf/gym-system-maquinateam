import {
  getViewerContextFromSession,
} from "@/lib/academy/access";
import { checkOutStudent } from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { checkOutSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAttendance");
    const input = await parseJsonBody(request, checkOutSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "attendance-check-out", input.attendanceId],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await checkOutStudent(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse({
        attendanceId: result.id,
        message: "Check-out registrado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "attendance check-out route",
      headers: rateLimitHeaders,
    });
  }
}
