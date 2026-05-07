import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  adminLimiter,
} from "@/lib/rate-limit";
import {
  getBrandConfig,
  updateBrandConfig,
} from "@/lib/settings/service";
import { parseJsonBody, updateBrandConfigSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAppSettings");
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id, "settings-get"],
    });
    rateLimitHeaders = rateLimit.headers;

    const brand = await getBrandConfig();
    return attachRateLimitHeaders(
      successResponse({ brand }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "admin settings get route",
      headers: rateLimitHeaders,
    });
  }
}

export async function PATCH(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageAppSettings");
    const input = await parseJsonBody(request, updateBrandConfigSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id, "settings-update"],
    });
    rateLimitHeaders = rateLimit.headers;

    const brand = await updateBrandConfig(input, {
      actorId: session.user.id,
      request,
    });

    return attachRateLimitHeaders(
      successResponse({ brand, message: "Configuracoes atualizadas." }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "admin settings update route",
      headers: rateLimitHeaders,
    });
  }
}
