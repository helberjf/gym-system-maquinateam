import { getViewerContextFromSession } from "@/lib/academy/access";
import { handleRouteError } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  reportLimiter,
} from "@/lib/rate-limit";
import { buildExportResponse } from "@/lib/reports/exporters";
import { exportReportTable } from "@/lib/reports/service";
import { parseSearchParams, reportExportQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

function buildFilename(kind: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `relatorio-${kind}-${date}`;
}

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("exportReports");
    const query = parseSearchParams(
      new URL(request.url).searchParams,
      reportExportQuerySchema,
    );
    const rateLimit = await enforceRateLimit({
      request,
      limiter: reportLimiter,
      keyParts: [session.user.id, query.kind],
    });
    rateLimitHeaders = rateLimit.headers;

    const viewer = await getViewerContextFromSession(session);
    const table = await exportReportTable(viewer, query, query.kind);
    const response = buildExportResponse({
      table,
      format: query.format,
      filenameBase: buildFilename(query.kind),
    });

    return attachRateLimitHeaders(response, rateLimitHeaders);
  } catch (error) {
    return handleRouteError(error, {
      source: "reports export route",
      headers: rateLimitHeaders,
    });
  }
}
