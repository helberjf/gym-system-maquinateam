import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import {
  ensureVisiblePayment,
  getPaymentVisibilityWhere,
} from "@/lib/billing/access";
import { logAuditEvent } from "@/lib/audit";
import { type ViewerContext } from "@/lib/academy/access";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ensureNextRecurringPaymentForSubscription } from "@/lib/billing/recurrence";
import { isPaymentOverdue, type PaymentMethodFilter } from "@/lib/billing/constants";
import { startOfDay } from "@/lib/academy/constants";
import {
  type PaymentFiltersInput,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type MutationContext,
  parseDateOnly,
  normalizeOptionalString,
  buildPaymentStatusWhere,
  buildPaymentMethodWhere,
  ensureStudentExists,
  ensureSubscriptionForStudent,
  ensureNoDuplicatePayment,
  syncSubscriptionFinancialStatus,
  getPaymentOptions,
} from "@/lib/billing/utils";

export async function getPaymentsIndexData(
  viewer: ViewerContext,
  filters: PaymentFiltersInput,
) {
  const today = startOfDay();
  const where: Prisma.PaymentWhereInput = {
    AND: [
      getPaymentVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                studentProfile: {
                  user: { name: { contains: filters.search, mode: "insensitive" } },
                },
              },
              {
                studentProfile: {
                  registrationNumber: { contains: filters.search, mode: "insensitive" },
                },
              },
              { description: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {},
      filters.studentId ? { studentProfileId: filters.studentId } : {},
      filters.subscriptionId ? { subscriptionId: filters.subscriptionId } : {},
      buildPaymentStatusWhere(filters.status, today) ?? {},
      buildPaymentMethodWhere(
        filters.method as PaymentMethodFilter | undefined,
      ) ?? {},
      filters.dateFrom || filters.dateTo
        ? {
            dueDate: {
              ...(filters.dateFrom ? { gte: parseDateOnly(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: parseDateOnly(filters.dateTo) } : {}),
            },
          }
        : {},
    ],
  };

  const [totalPayments, summaryRows, options] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      select: {
        amountCents: true,
        status: true,
        dueDate: true,
        studentProfileId: true,
      },
    }),
    getPaymentOptions(viewer),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalPayments,
  });
  const payments = await prisma.payment.findMany({
    where,
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      amountCents: true,
      status: true,
      method: true,
      dueDate: true,
      paidAt: true,
      description: true,
      notes: true,
      createdAt: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: { select: { name: true } },
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          plan: { select: { id: true, name: true } },
        },
      },
    },
  });

  const summary = summaryRows.reduce(
    (acc, payment) => {
      const overdue = isPaymentOverdue(payment.status, payment.dueDate, today);

      acc.totalPayments += 1;

      if (payment.status === PaymentStatus.PAID) {
        acc.paidPayments += 1;
        acc.receivedCents += payment.amountCents;
      }

      if (payment.status === PaymentStatus.PENDING) {
        acc.pendingPayments += 1;
        acc.outstandingCents += payment.amountCents;
      }

      if (overdue) {
        acc.overduePayments += 1;
        acc.overdueCents += payment.amountCents;
        acc.delinquentStudentIds.add(payment.studentProfileId);
      }

      return acc;
    },
    {
      totalPayments: 0,
      pendingPayments: 0,
      paidPayments: 0,
      overduePayments: 0,
      outstandingCents: 0,
      overdueCents: 0,
      receivedCents: 0,
      delinquentStudentIds: new Set<string>(),
    },
  );

  return {
    payments,
    pagination,
    summary: {
      totalPayments: summary.totalPayments,
      pendingPayments: summary.pendingPayments,
      paidPayments: summary.paidPayments,
      overduePayments: summary.overduePayments,
      outstandingCents: summary.outstandingCents,
      overdueCents: summary.overdueCents,
      receivedCents: summary.receivedCents,
      delinquentStudents: summary.delinquentStudentIds.size,
    },
    options,
    canManage: hasPermission(viewer.role, "managePayments"),
  };
}

export async function getPaymentDetailData(
  viewer: ViewerContext,
  paymentId: string,
) {
  await ensureVisiblePayment(viewer, paymentId);

  const payment = await prisma.payment.findFirst({
    where: { AND: [getPaymentVisibilityWhere(viewer), { id: paymentId }] },
    select: {
      id: true,
      amountCents: true,
      status: true,
      method: true,
      dueDate: true,
      paidAt: true,
      description: true,
      notes: true,
      createdAt: true,
      createdByUser: { select: { name: true } },
      processedByUser: { select: { name: true } },
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: { select: { name: true, email: true } },
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          plan: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError("Pagamento nao encontrado.");
  }

  const relatedPayments = await prisma.payment.findMany({
    where: {
      AND: [
        getPaymentVisibilityWhere(viewer),
        { subscriptionId: payment.subscription.id, id: { not: payment.id } },
      ],
    },
    orderBy: [{ dueDate: "desc" }],
    take: 8,
    select: {
      id: true,
      amountCents: true,
      status: true,
      method: true,
      dueDate: true,
      paidAt: true,
      description: true,
    },
  });

  return {
    payment,
    relatedPayments,
    options: await getPaymentOptions(viewer),
    canManage: hasPermission(viewer.role, "managePayments"),
  };
}

export async function createPayment(
  input: CreatePaymentInput,
  context: MutationContext,
) {
  const dueDate = parseDateOnly(input.dueDate)!;

  const payment = await prisma.$transaction(async (tx) => {
    await ensureStudentExists(tx, input.studentProfileId);
    await ensureSubscriptionForStudent(tx, input.subscriptionId, input.studentProfileId);
    await ensureNoDuplicatePayment(tx, {
      studentProfileId: input.studentProfileId,
      subscriptionId: input.subscriptionId,
      dueDate,
    });

    const created = await tx.payment.create({
      data: {
        studentProfileId: input.studentProfileId,
        subscriptionId: input.subscriptionId,
        amountCents: input.amountCents,
        status: input.status,
        method: input.method as PaymentMethod,
        dueDate,
        paidAt:
          input.status === PaymentStatus.PAID
            ? parseDateOnly(input.paidAt) ?? new Date()
            : null,
        description: normalizeOptionalString(input.description),
        notes: normalizeOptionalString(input.notes),
        createdByUserId: context.viewer.userId,
        processedByUserId:
          input.status === PaymentStatus.PAID ? context.viewer.userId : null,
      },
      select: { id: true, status: true },
    });

    await syncSubscriptionFinancialStatus(tx, input.subscriptionId);
    if (input.status === PaymentStatus.PAID) {
      await ensureNextRecurringPaymentForSubscription(tx, {
        subscriptionId: input.subscriptionId,
      });
    }

    return created;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PAYMENT_CREATED",
    entityType: "Payment",
    entityId: payment.id,
    summary: "Mensalidade criada.",
    afterData: {
      studentProfileId: input.studentProfileId,
      subscriptionId: input.subscriptionId,
      amountCents: input.amountCents,
      status: input.status,
      dueDate: input.dueDate,
    },
  });

  return payment;
}

export async function updatePayment(
  input: UpdatePaymentInput,
  context: MutationContext,
) {
  const existing = await prisma.payment.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      status: true,
      amountCents: true,
      dueDate: true,
      paidAt: true,
      studentProfileId: true,
      subscriptionId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Pagamento nao encontrado.");
  }

  if (
    existing.status === PaymentStatus.PAID &&
    input.status === PaymentStatus.CANCELLED
  ) {
    throw new ConflictError(
      "Pagamentos ja registrados como pagos nao podem ser cancelados por este fluxo.",
    );
  }

  const dueDate = parseDateOnly(input.dueDate)!;

  const payment = await prisma.$transaction(async (tx) => {
    await ensureStudentExists(tx, input.studentProfileId);
    await ensureSubscriptionForStudent(tx, input.subscriptionId, input.studentProfileId);
    await ensureNoDuplicatePayment(tx, {
      paymentId: input.id,
      studentProfileId: input.studentProfileId,
      subscriptionId: input.subscriptionId,
      dueDate,
    });

    const updated = await tx.payment.update({
      where: { id: input.id },
      data: {
        studentProfileId: input.studentProfileId,
        subscriptionId: input.subscriptionId,
        amountCents: input.amountCents,
        status: input.status,
        method: input.method as PaymentMethod,
        dueDate,
        paidAt:
          input.status === PaymentStatus.PAID
            ? parseDateOnly(input.paidAt) ?? existing.paidAt ?? new Date()
            : null,
        description: normalizeOptionalString(input.description),
        notes: normalizeOptionalString(input.notes),
        processedByUserId:
          input.status === PaymentStatus.PAID ? context.viewer.userId : null,
      },
      select: { id: true, status: true, amountCents: true, dueDate: true },
    });

    await syncSubscriptionFinancialStatus(tx, input.subscriptionId);
    if (input.status === PaymentStatus.PAID) {
      await ensureNextRecurringPaymentForSubscription(tx, {
        subscriptionId: input.subscriptionId,
      });
    }

    return updated;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PAYMENT_UPDATED",
    entityType: "Payment",
    entityId: payment.id,
    summary: "Pagamento atualizado.",
    beforeData: {
      status: existing.status,
      amountCents: existing.amountCents,
      dueDate: existing.dueDate?.toISOString() ?? null,
      paidAt: existing.paidAt?.toISOString() ?? null,
    },
    afterData: {
      status: payment.status,
      amountCents: payment.amountCents,
      dueDate: payment.dueDate?.toISOString() ?? null,
      paidAt:
        input.status === PaymentStatus.PAID
          ? (parseDateOnly(input.paidAt) ?? new Date()).toISOString()
          : null,
    },
  });

  return payment;
}

export async function cancelPayment(paymentId: string, context: MutationContext) {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, subscriptionId: true },
  });

  if (!existing) {
    throw new NotFoundError("Pagamento nao encontrado.");
  }

  if (existing.status === PaymentStatus.PAID) {
    throw new ConflictError(
      "Nao e possivel cancelar um pagamento que ja foi marcado como pago.",
    );
  }

  const payment = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CANCELLED, paidAt: null, processedByUserId: null },
      select: { id: true, status: true },
    });

    await syncSubscriptionFinancialStatus(tx, existing.subscriptionId);

    return cancelled;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PAYMENT_CANCELLED",
    entityType: "Payment",
    entityId: payment.id,
    summary: "Pagamento cancelado.",
    beforeData: { status: existing.status },
    afterData: { status: payment.status },
  });

  return payment;
}
