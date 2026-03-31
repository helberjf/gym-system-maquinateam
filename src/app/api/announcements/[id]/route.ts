import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  unpublishAnnouncement,
  updateAnnouncement,
} from "@/lib/training/service";
import { parseJsonBody, updateAnnouncementSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAnnouncements");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateAnnouncementSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "announcement-update", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateAnnouncement(
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
        announcementId: result.id,
        message: "Aviso atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "announcements update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAnnouncements");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "announcement-delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await unpublishAnnouncement(id, {
      viewer,
      request,
    });

    return attachRateLimitHeaders(
      successResponse({
        message: "Aviso despublicado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "announcements delete route",
      headers: rateLimitHeaders,
    });
  }
}
