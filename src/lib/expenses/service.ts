import { ExpenseCategory, type Prisma } from "@prisma/client";
import type { z } from "zod";
import type { ViewerContext } from "@/lib/academy/access";
import { logAuditEvent } from "@/lib/audit";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { buildOffsetPagination } from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { logger, serializeError } from "@/lib/observability/logger";
import { getMercadoPagoFinancialSummary } from "@/lib/payments/mercadopago";
import { prisma } from "@/lib/prisma";
import type {
  createExpenseSchema,
  expenseFiltersSchema,
  updateExpenseSchema,
} from "@/lib/validators";

type CreateInput = z.infer<typeof createExpenseSchema>;
type UpdateInput = z.infer<typeof updateExpenseSchema>;
type FiltersInput = z.infer<typeof expenseFiltersSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

const PAGE_SIZE = 20;

function assertCanManage(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageExpenses")) {
    throw new ForbiddenError("Sem permissao para gerenciar despesas.");
  }
}

function parseDateOnly(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function buildDateRange(filters: FiltersInput) {
  const from = parseDateOnly(filters.dateFrom);
  const to = parseDateOnly(filters.dateTo);
  if (!from && !to) {
    return undefined;
  }
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

export async function listExpenses(
  filters: FiltersInput,
  viewer: ViewerContext,
) {
  assertCanManage(viewer);

  const where: Prisma.ExpenseWhereInput = {
    ...(filters.category ? { category: filters.category } : {}),
    ...(() => {
      const range = buildDateRange(filters);
      return range ? { incurredAt: range } : {};
    })(),
  };

  const total = await prisma.expense.count({ where });

  const pagination = buildOffsetPagination({
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
    totalItems: total,
  });

  const items = await prisma.expense.findMany({
    where,
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      createdByUser: { select: { id: true, name: true } },
    },
  });

  return { items, pagination };
}

export async function createExpense(
  input: CreateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);

  if (input.category === ExpenseCategory.MP_FEE) {
    throw new BadRequestError(
      "Despesas da categoria MP_FEE sao automaticas.",
    );
  }

  const created = await prisma.expense.create({
    data: {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      incurredAt: parseDateOnly(input.incurredAt)!,
      notes: input.notes ?? null,
      createdByUserId: context.viewer.userId,
    },
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "expense.create",
    entityType: "Expense",
    entityId: created.id,
    summary: `Despesa ${created.category} registrada (${created.amountCents} cents).`,
    afterData: created,
    request: context.request,
  });

  return created;
}

export async function updateExpense(
  input: UpdateInput,
  context: MutationContext,
) {
  assertCanManage(context.viewer);

  const existing = await prisma.expense.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new NotFoundError("Despesa nao encontrada.");
  }

  if (existing.category === ExpenseCategory.MP_FEE) {
    throw new BadRequestError(
      "Despesas de taxa MercadoPago nao podem ser editadas.",
    );
  }

  const updated = await prisma.expense.update({
    where: { id: input.id },
    data: {
      category: input.category ?? undefined,
      description: input.description ?? undefined,
      amountCents: input.amountCents ?? undefined,
      incurredAt: input.incurredAt
        ? parseDateOnly(input.incurredAt)!
        : undefined,
      notes: input.notes !== undefined ? input.notes ?? null : undefined,
    },
  });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "expense.update",
    entityType: "Expense",
    entityId: updated.id,
    summary: `Despesa ${updated.id} atualizada.`,
    beforeData: existing,
    afterData: updated,
    request: context.request,
  });

  return updated;
}

export async function deleteExpense(id: string, context: MutationContext) {
  assertCanManage(context.viewer);

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Despesa nao encontrada.");
  }

  if (existing.category === ExpenseCategory.MP_FEE) {
    throw new BadRequestError(
      "Despesas de taxa MercadoPago nao podem ser excluidas.",
    );
  }

  await prisma.expense.delete({ where: { id } });

  await logAuditEvent({
    actorId: context.viewer.userId,
    action: "expense.delete",
    entityType: "Expense",
    entityId: id,
    summary: `Despesa ${id} removida.`,
    beforeData: existing,
    request: context.request,
  });

  return { id };
}

type MpFeeCaptureInput = {
  checkoutPaymentId: string;
  paidAt: Date;
  paymentDetails: unknown;
};

function extractMercadoPagoFeeCents(paymentDetails: unknown): number {
  if (!paymentDetails || typeof paymentDetails !== "object") {
    return 0;
  }

  const details = paymentDetails as { fee_details?: unknown };
  if (!Array.isArray(details.fee_details)) {
    return 0;
  }

  let totalReais = 0;
  for (const entry of details.fee_details) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const amount = (entry as { amount?: unknown }).amount;
    const numericAmount =
      typeof amount === "number"
        ? amount
        : typeof amount === "string"
          ? Number(amount)
          : Number.NaN;
    if (Number.isFinite(numericAmount) && numericAmount > 0) {
      totalReais += numericAmount;
    }
  }

  return Math.round(totalReais * 100);
}

export async function recordMercadoPagoFeeForCheckout(
  input: MpFeeCaptureInput,
) {
  const summary = getMercadoPagoFinancialSummary(
    input.paymentDetails as Parameters<typeof getMercadoPagoFinancialSummary>[0],
  );
  const amountCents =
    summary.feeCents > 0
      ? summary.feeCents
      : extractMercadoPagoFeeCents(input.paymentDetails);
  if (amountCents <= 0) {
    return null;
  }

  const incurredAt = new Date(
    Date.UTC(
      input.paidAt.getUTCFullYear(),
      input.paidAt.getUTCMonth(),
      input.paidAt.getUTCDate(),
    ),
  );

  try {
    return await prisma.expense.upsert({
      where: { sourceCheckoutPaymentId: input.checkoutPaymentId },
      create: {
        category: ExpenseCategory.MP_FEE,
        description: `Taxa MercadoPago - pagamento ${summary.providerPaymentId ?? input.checkoutPaymentId}`,
        amountCents,
        incurredAt,
        sourceCheckoutPaymentId: input.checkoutPaymentId,
        notes: JSON.stringify({
          providerPaymentId: summary.providerPaymentId,
          paymentMethodId: summary.paymentMethodId,
          installments: summary.installments,
          grossAmountCents: summary.amountCents,
          netReceivedCents: summary.netReceivedCents,
          feeDetails: summary.feeDetails,
        }),
      },
      update: {
        description: `Taxa MercadoPago - pagamento ${summary.providerPaymentId ?? input.checkoutPaymentId}`,
        amountCents,
        incurredAt,
        notes: JSON.stringify({
          providerPaymentId: summary.providerPaymentId,
          paymentMethodId: summary.paymentMethodId,
          installments: summary.installments,
          grossAmountCents: summary.amountCents,
          netReceivedCents: summary.netReceivedCents,
          feeDetails: summary.feeDetails,
        }),
      },
    });
  } catch (error) {
    logger.error("expenses.mp_fee_capture_failed", {
      error: serializeError(error),
    });
    return null;
  }
}
