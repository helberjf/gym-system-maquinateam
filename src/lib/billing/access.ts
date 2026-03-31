import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { ViewerContext } from "@/lib/academy/access";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function noAccessId() {
  return "__no_access__";
}

export function getPlanVisibilityWhere(
  viewer: ViewerContext,
): Prisma.PlanWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            OR: [
              {
                active: true,
              },
              {
                subscriptions: {
                  some: {
                    studentProfileId: viewer.studentProfileId,
                  },
                },
              },
            ],
          }
        : {
            id: noAccessId(),
          };
    default:
      return {
        id: noAccessId(),
      };
  }
}

export function getSubscriptionVisibilityWhere(
  viewer: ViewerContext,
): Prisma.SubscriptionWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            studentProfileId: viewer.studentProfileId,
          }
        : {
            id: noAccessId(),
          };
    default:
      return {
        id: noAccessId(),
      };
  }
}

export function getPaymentVisibilityWhere(
  viewer: ViewerContext,
): Prisma.PaymentWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            studentProfileId: viewer.studentProfileId,
          }
        : {
            id: noAccessId(),
          };
    default:
      return {
        id: noAccessId(),
      };
  }
}

export async function ensureVisiblePlan(viewer: ViewerContext, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: {
      AND: [getPlanVisibilityWhere(viewer), { id: planId }],
    },
    select: {
      id: true,
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano nao encontrado ou indisponivel.");
  }

  return plan;
}

export async function ensureVisibleSubscription(
  viewer: ViewerContext,
  subscriptionId: string,
) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      AND: [getSubscriptionVisibilityWhere(viewer), { id: subscriptionId }],
    },
    select: {
      id: true,
    },
  });

  if (!subscription) {
    throw new NotFoundError("Assinatura nao encontrada ou indisponivel.");
  }

  return subscription;
}

export async function ensureVisiblePayment(
  viewer: ViewerContext,
  paymentId: string,
) {
  const payment = await prisma.payment.findFirst({
    where: {
      AND: [getPaymentVisibilityWhere(viewer), { id: paymentId }],
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    throw new NotFoundError("Pagamento nao encontrado ou indisponivel.");
  }

  return payment;
}
