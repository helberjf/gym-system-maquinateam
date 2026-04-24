import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  reportLimiter,
} from "@/lib/rate-limit";
import { exportDreCsv, getDreReport } from "@/lib/reports/dre";
import { dreFiltersSchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";

function buildFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `dre-${date}.csv`;
}

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewFinancialReports");
    const filters = parseSearchParams(
      new URL(request.url).searchParams,
      dreFiltersSchema,
    );
    const rateLimit = await enforceRateLimit({
      request,
      limiter: reportLimiter,
      keyParts: [session.user.id, "dre"],
    });
    rateLimitHeaders = rateLimit.headers;

    const viewer = await getViewerContextFromSession(session);
    const report = await getDreReport(viewer, filters);
    const csv = exportDreCsv(report);

    const response = new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildFilename()}"`,
        "Cache-Control": "no-store",
      },
    });

    return attachRateLimitHeaders(response, rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "dre export route",
      headers: rateLimitHeaders,
    });
  }
}
