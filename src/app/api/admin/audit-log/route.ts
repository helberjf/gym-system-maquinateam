import { handleRouteError, successResponse } from "@/lib/errors";
import {
  adminLimiter,
  attachRateLimitHeaders,
  enforceRateLimit,
} from "@/lib/rate-limit";
import { requireApiPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("accessAdminEndpoints");
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id],
    });
    rateLimitHeaders = rateLimit.headers;

    const logs = await prisma.auditLog.findMany({
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        actor: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return attachRateLimitHeaders(successResponse({ logs }), rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "admin audit log route",
      headers: rateLimitHeaders,
    });
  }
}
