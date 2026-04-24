import { getViewerContextFromSession } from "@/lib/academy/access";
import { createExpense, listExpenses } from "@/lib/expenses/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  createExpenseSchema,
  expenseFiltersSchema,
  parseJsonBody,
  parseSearchParams,
} from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageExpenses");
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, expenseFiltersSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "expenses-list"],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await listExpenses(filters, viewer);

    return attachRateLimitHeaders(
      successResponse(result),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "expenses list route",
      headers: rateLimitHeaders,
    });
  }
}

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageExpenses");
    const input = await parseJsonBody(request, createExpenseSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "expenses-create"],
    });
    rateLimitHeaders = rateLimit.headers;

    const created = await createExpense(input, { viewer, request });

    return attachRateLimitHeaders(
      successResponse(
        {
          expenseId: created.id,
          message: "Despesa registrada com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "expenses create route",
      headers: rateLimitHeaders,
    });
  }
}
