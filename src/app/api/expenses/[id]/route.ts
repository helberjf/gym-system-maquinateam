import { getViewerContextFromSession } from "@/lib/academy/access";
import { deleteExpense, updateExpense } from "@/lib/expenses/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import {
  parseJsonBody,
  updateExpenseSchema,
} from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageExpenses");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateExpenseSchema);
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "expense-update", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const updated = await updateExpense(
      { ...input, id },
      { viewer, request },
    );

    return attachRateLimitHeaders(
      successResponse({
        expenseId: updated.id,
        message: "Despesa atualizada com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "expense update route",
      headers: rateLimitHeaders,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageExpenses");
    const { id } = await context.params;
    const viewer = await getViewerContextFromSession(session);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "expense-delete", id],
    });
    rateLimitHeaders = rateLimit.headers;

    await deleteExpense(id, { viewer, request });

    return attachRateLimitHeaders(
      successResponse({ message: "Despesa removida com sucesso." }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "expense delete route",
      headers: rateLimitHeaders,
    });
  }
}
