import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createAnnouncement } from "@/lib/training/service";
import { createAnnouncementSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAnnouncements");
    const input = await parseJsonBody(request, createAnnouncementSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "announcement", input.slug ?? input.title],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createAnnouncement(input, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          announcementId: result.id,
          message: "Aviso criado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "announcements create route",
      headers: rateLimitHeaders,
    });
  }
}
