import { safeRunAnalyticsChat } from "@/lib/ai/analytics-chat";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  adminLimiter,
  attachRateLimitHeaders,
  enforceRateLimit,
} from "@/lib/rate-limit";
import { analyticsChatSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("accessAdminEndpoints");
    const input = await parseJsonBody(request, analyticsChatSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id, "analytics-chat"],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await safeRunAnalyticsChat({
      userMessage: input.message,
      history: input.history ?? [],
    });

    return attachRateLimitHeaders(
      successResponse({
        reply: result.reply,
        toolsUsed: result.toolsUsed,
        toolResults: result.toolResults,
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "analytics chat route",
      headers: rateLimitHeaders,
    });
  }
}
