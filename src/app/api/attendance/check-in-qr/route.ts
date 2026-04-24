import { getViewerContextFromSession } from "@/lib/academy/access";
import { verifyStudentCheckinToken } from "@/lib/academy/qr-token";
import { checkInStudent } from "@/lib/academy/service";
import {
  BadRequestError,
  handleRouteError,
  successResponse,
  UnauthorizedError,
} from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, qrCheckInSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAttendance");
    const input = await parseJsonBody(request, qrCheckInSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "attendance-check-in-qr"],
    });
    rateLimitHeaders = rateLimit.headers;

    const verified = verifyStudentCheckinToken(input.token);
    if (!verified.ok) {
      if (verified.reason === "expired") {
        throw new UnauthorizedError(
          "QR code expirou. Peca ao aluno para atualizar.",
        );
      }
      throw new BadRequestError("QR code invalido.");
    }

    const result = await checkInStudent(
      {
        studentProfileId: verified.payload.studentProfileId,
        classScheduleId: input.classScheduleId,
        classDate: input.classDate,
        overrideFinancial: input.overrideFinancial ?? false,
      },
      { viewer, request },
    );

    return attachRateLimitHeaders(
      successResponse(
        {
          attendanceId: result.id,
          studentProfileId: verified.payload.studentProfileId,
          message: "Check-in por QR registrado.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "attendance check-in-qr route",
      headers: rateLimitHeaders,
    });
  }
}
