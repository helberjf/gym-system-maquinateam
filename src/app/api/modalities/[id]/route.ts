import { archiveModality, updateModality } from "@/lib/academy/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody, updateModalitySchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageModalities");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateModalitySchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "modalities", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await updateModality(
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
        modalityId: result.id,
        slug: result.slug,
        message: "Modalidade atualizada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "modalities update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageModalities");
    const { id } = await context.params;
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "modalities", "delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await archiveModality(id, {
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
        message: "Modalidade arquivada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "modalities delete route",
      headers: rateLimitHeaders,
    });
  }
}
