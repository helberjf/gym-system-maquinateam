import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PENDING,
];

function clampRenewalDay(day: number | null | undefined) {
  if (!day || Number.isNaN(day)) {
    return null;
  }

  return Math.min(31, Math.max(1, Math.trunc(day)));
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getNextBillingDueDate(
  baseDate: Date,
  intervalMonths: number,
  renewalDay?: number | null,
) {
  const months = Math.max(1, Math.trunc(intervalMonths || 1));
  const targetMonth = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + months, 1),
  );
  const targetYear = targetMonth.getUTCFullYear();
  const targetMonthIndex = targetMonth.getUTCMonth();
  const preferredDay =
    clampRenewalDay(renewalDay) ?? clampRenewalDay(baseDate.getUTCDate()) ?? 1;
  const dueDay = Math.min(
    preferredDay,
    daysInUtcMonth(targetYear, targetMonthIndex),
  );

  return new Date(Date.UTC(targetYear, targetMonthIndex, dueDay));
}

function buildRecurringExternalReference(subscriptionId: string, dueDate: Date) {
  return `REC-${subscriptionId}-${dueDate.toISOString().slice(0, 10)}`;
}

export async function ensureNextRecurringPaymentForSubscription(
  tx: Prisma.TransactionClient,
  input: { subscriptionId: string },
) {
  const subscription = await tx.subscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      studentProfileId: true,
      status: true,
      startDate: true,
      autoRenew: true,
      renewalDay: true,
      priceCents: true,
      discountCents: true,
      checkoutPayment: {
        select: {
          method: true,
        },
      },
      plan: {
        select: {
          name: true,
          billingIntervalMonths: true,
        },
      },
    },
  });

  if (
    !subscription?.autoRenew ||
    !BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)
  ) {
    return null;
  }

  const openPayment = await tx.payment.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: PaymentStatus.PENDING,
    },
    select: { id: true },
  });

  if (openPayment) {
    return null;
  }

  const latestPaidPayment = await tx.payment.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: PaymentStatus.PAID,
      dueDate: { not: null },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    select: {
      dueDate: true,
      method: true,
    },
  });

  if (!latestPaidPayment?.dueDate) {
    return null;
  }

  const amountCents = Math.max(
    0,
    subscription.priceCents - subscription.discountCents,
  );

  if (amountCents <= 0) {
    return null;
  }

  const dueDate = getNextBillingDueDate(
    latestPaidPayment.dueDate,
    subscription.plan.billingIntervalMonths,
    subscription.renewalDay,
  );
  const externalReference = buildRecurringExternalReference(
    subscription.id,
    dueDate,
  );

  const existingByReference = await tx.payment.findFirst({
    where: { externalReference },
    select: { id: true },
  });

  if (existingByReference) {
    return { ...existingByReference, created: false };
  }

  const duplicatePayment = await tx.payment.findFirst({
    where: {
      studentProfileId: subscription.studentProfileId,
      subscriptionId: subscription.id,
      dueDate,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
    },
    select: { id: true },
  });

  if (duplicatePayment) {
    return { ...duplicatePayment, created: false };
  }

  const created = await tx.payment.create({
    data: {
      studentProfileId: subscription.studentProfileId,
      subscriptionId: subscription.id,
      amountCents,
      status: PaymentStatus.PENDING,
      method:
        latestPaidPayment.method ??
        subscription.checkoutPayment?.method ??
        PaymentMethod.PIX,
      dueDate,
      externalReference,
      description: `Mensalidade recorrente do plano ${subscription.plan.name}`,
    },
    select: { id: true },
  });

  return { ...created, created: true };
}

export async function generateRecurringSubscriptionPayments() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      status: { in: [...BILLABLE_SUBSCRIPTION_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let created = 0;

  for (const subscription of subscriptions) {
    const payment = await prisma.$transaction((tx) =>
      ensureNextRecurringPaymentForSubscription(tx, {
        subscriptionId: subscription.id,
      }),
    );

    if (payment?.created) {
      created += 1;
    }
  }

  return {
    checked: subscriptions.length,
    created,
  };
}
