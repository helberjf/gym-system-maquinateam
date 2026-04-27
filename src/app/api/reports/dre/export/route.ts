import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  reportLimiter,
} from "@/lib/rate-limit";
import { exportDreTable, getDreReport } from "@/lib/reports/dre";
import { buildExportResponse } from "@/lib/reports/exporters";
import { dreExportQuerySchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";

function buildFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `dre-${date}`;
}

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("viewFinancialReports");
    const filters = parseSearchParams(
      new URL(request.url).searchParams,
      dreExportQuerySchema,
    );
    const rateLimit = await enforceRateLimit({
      request,
      limiter: reportLimiter,
      keyParts: [session.user.id, "dre"],
    });
    rateLimitHeaders = rateLimit.headers;

    const viewer = await getViewerContextFromSession(session);
    const report = await getDreReport(viewer, filters);
    const response = buildExportResponse({
      table: exportDreTable(report),
      format: filters.format,
      filenameBase: buildFilename(),
    });

    return attachRateLimitHeaders(response, rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "dre export route",
      headers: rateLimitHeaders,
    });
  }
}
