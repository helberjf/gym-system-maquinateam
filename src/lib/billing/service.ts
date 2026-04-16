import type { z } from "zod";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  StudentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import {
  ensureVisiblePayment,
  ensureVisiblePlan,
  ensureVisibleSubscription,
  getPaymentVisibilityWhere,
  getPlanVisibilityWhere,
  getSubscriptionVisibilityWhere,
} from "@/lib/billing/access";
import {
  getPaymentMethodFilterValues,
  isPaymentOverdue,
  type PaymentMethodFilter,
  type PaymentFilterStatus,
} from "@/lib/billing/constants";
import { logAuditEvent } from "@/lib/audit";
import { getModalityVisibilityWhere, type ViewerContext } from "@/lib/academy/access";
import { slugify, startOfDay } from "@/lib/academy/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  createPaymentSchema,
  createPlanSchema,
  createSubscriptionSchema,
  paymentFiltersSchema,
  planFiltersSchema,
  subscriptionFiltersSchema,
  updatePaymentSchema,
  updatePlanSchema,
  updateSubscriptionSchema,
} from "@/lib/validators";

const autoSyncedSubscriptionStatuses: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PENDING,
];

type PlanFiltersInput = z.infer<typeof planFiltersSchema>;
type SubscriptionFiltersInput = z.infer<typeof subscriptionFiltersSchema>;
type PaymentFiltersInput = z.infer<typeof paymentFiltersSchema>;
type CreatePlanInput = z.infer<typeof createPlanSchema>;
type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

function parseDateOnly(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return startOfDay(value);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonths(date: Date, amount: number) {
  const value = new Date(date);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value;
}

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

function normalizeBenefits(benefits: string[]) {
  return Array.from(new Set(benefits.map((item) => item.trim()).filter(Boolean)));
}

function buildPlanRecurrenceMonths(input: {
  durationMonths?: number | null;
  billingIntervalMonths: number;
}) {
  return input.durationMonths ?? input.billingIntervalMonths;
}

function buildPaymentStatusWhere(
  status?: PaymentFilterStatus,
  referenceDate = startOfDay(),
): Prisma.PaymentWhereInput | undefined {
  if (!status) {
    return undefined;
  }

  if (status === "OVERDUE") {
    return {
      status: PaymentStatus.PENDING,
      dueDate: {
        lt: referenceDate,
      },
    };
  }

  return { status };
}

function buildPaymentMethodWhere(
  method?: PaymentMethodFilter,
): Prisma.PaymentWhereInput | undefined {
  if (!method) {
    return undefined;
  }

  return {
    method: {
      in: getPaymentMethodFilterValues(method),
    },
  };
}

async function ensureActiveModality(
  tx: Prisma.TransactionClient,
  modalityId: string,
) {
  const modality = await tx.modality.findUnique({
    where: { id: modalityId },
    select: { id: true, isActive: true },
  });

  if (!modality) {
    throw new NotFoundError("Modalidade nao encontrada.");
  }

  if (!modality.isActive) {
    throw new ConflictError("Selecione uma modalidade ativa.");
  }

  return modality;
}

async function ensureStudentExists(
  tx: Prisma.TransactionClient,
  studentProfileId: string,
) {
  const student = await tx.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      id: true,
      status: true,
      registrationNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Aluno nao encontrado.");
  }

  return student;
}

async function ensurePlanExists(tx: Prisma.TransactionClient, planId: string) {
  const plan = await tx.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      active: true,
      priceCents: true,
      billingIntervalMonths: true,
      durationMonths: true,
      modalityId: true,
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano nao encontrado.");
  }

  return plan;
}

async function ensureSubscriptionForStudent(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
  studentProfileId: string,
) {
  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      studentProfileId: true,
      status: true,
      startDate: true,
      endDate: true,
      autoRenew: true,
      renewalDay: true,
      priceCents: true,
      discountCents: true,
      plan: {
        select: {
          id: true,
          name: true,
          active: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new NotFoundError("Assinatura nao encontrada.");
  }

  if (subscription.studentProfileId !== studentProfileId) {
    throw new ConflictError("A assinatura selecionada nao pertence ao aluno informado.");
  }

  return subscription;
}

async function ensureNoDuplicatePayment(
  tx: Prisma.TransactionClient,
  input: {
    paymentId?: string;
    studentProfileId: string;
    subscriptionId: string;
    dueDate: Date;
  },
) {
  const existing = await tx.payment.findFirst({
    where: {
      studentProfileId: input.studentProfileId,
      subscriptionId: input.subscriptionId,
      dueDate: input.dueDate,
      status: {
        in: [PaymentStatus.PENDING, PaymentStatus.PAID],
      },
      ...(input.paymentId
        ? {
            id: {
              not: input.paymentId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ConflictError(
      "Ja existe uma mensalidade aberta ou paga para esta assinatura na data informada.",
    );
  }
}

async function syncSubscriptionFinancialStatus(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
) {
  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      cancelledAt: true,
    },
  });

  if (!subscription) {
    return null;
  }

  if (
    subscription.status === SubscriptionStatus.CANCELLED ||
    subscription.status === SubscriptionStatus.PAUSED
  ) {
    return subscription.status;
  }

  const today = startOfDay();
  const overduePayments = await tx.payment.count({
    where: {
      subscriptionId,
      status: PaymentStatus.PENDING,
      dueDate: {
        lt: today,
      },
    },
  });

  let nextStatus = subscription.status;

  if (subscription.endDate && startOfDay(subscription.endDate) < today) {
    nextStatus = SubscriptionStatus.EXPIRED;
  } else if (overduePayments > 0) {
    nextStatus = SubscriptionStatus.PAST_DUE;
  } else if (startOfDay(subscription.startDate) > today) {
    nextStatus = SubscriptionStatus.PENDING;
  } else {
    nextStatus = SubscriptionStatus.ACTIVE;
  }

  if (nextStatus !== subscription.status) {
    await tx.subscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        status: nextStatus,
      },
    });
  }

  return nextStatus;
}

async function getPlanOptions(viewer: ViewerContext) {
  const modalities = await prisma.modality.findMany({
    where: {
      AND: [getModalityVisibilityWhere(viewer), { isActive: true }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  return { modalities };
}

async function getSubscriptionOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageSubscriptions")) {
    return null;
  }

  const [students, plans] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where: {
        status: {
          not: StudentStatus.INACTIVE,
        },
        user: {
          isActive: true,
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.plan.findMany({
      where: {
        active: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
      },
    }),
  ]);

  return { students, plans };
}

async function getPaymentOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "managePayments")) {
    return null;
  }

  const [students, subscriptions] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where: {
        user: {
          isActive: true,
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.subscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PENDING,
            SubscriptionStatus.PAUSED,
            SubscriptionStatus.EXPIRED,
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        studentProfileId: true,
        status: true,
        studentProfile: {
          select: {
            registrationNumber: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return { students, subscriptions };
}

export async function getPlansIndexData(
  viewer: ViewerContext,
  filters: PlanFiltersInput,
) {
  const where: Prisma.PlanWhereInput = {
    AND: [
      getPlanVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                slug: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.modalityId
        ? {
            modalityId: filters.modalityId,
          }
        : {},
      filters.active === true
        ? {
            active: true,
          }
        : filters.active === false
          ? {
              active: false,
            }
          : {},
    ],
  };

  const [totalPlans, activePlans, planPriceStats, options] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.count({
      where: {
        AND: [where, { active: true }],
      },
    }),
    prisma.plan.aggregate({
      where,
      _avg: {
        priceCents: true,
      },
    }),
    getPlanOptions(viewer),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalPlans,
  });
  const plans = await prisma.plan.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      benefits: true,
      priceCents: true,
      billingIntervalMonths: true,
      durationMonths: true,
      sessionsPerWeek: true,
      isUnlimited: true,
      enrollmentFeeCents: true,
      active: true,
      modality: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  const summary = {
    totalPlans,
    activePlans,
    inactivePlans: Math.max(0, totalPlans - activePlans),
    averagePriceCents: Math.round(planPriceStats._avg.priceCents ?? 0),
  };

  return {
    plans,
    pagination,
    summary,
    options,
    canManage: hasPermission(viewer.role, "managePlans"),
  };
}

export async function getPlanDetailData(
  viewer: ViewerContext,
  planId: string,
) {
  await ensureVisiblePlan(viewer, planId);

  const plan = await prisma.plan.findFirst({
    where: {
      AND: [getPlanVisibilityWhere(viewer), { id: planId }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      benefits: true,
      priceCents: true,
      billingIntervalMonths: true,
      durationMonths: true,
      sessionsPerWeek: true,
      isUnlimited: true,
      enrollmentFeeCents: true,
      active: true,
      modalityId: true,
      modality: {
        select: {
          id: true,
          name: true,
        },
      },
      subscriptions: {
        where: getSubscriptionVisibilityWhere(viewer),
        take: 8,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          studentProfile: {
            select: {
              id: true,
              registrationNumber: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano nao encontrado.");
  }

  return {
    plan,
    options: await getPlanOptions(viewer),
    canManage: hasPermission(viewer.role, "managePlans"),
  };
}

export async function createPlan(
  input: CreatePlanInput,
  context: MutationContext,
) {
  const slug = input.slug ?? slugify(input.name);

  const plan = await prisma.$transaction(async (tx) => {
    if (input.modalityId) {
      await ensureActiveModality(tx, input.modalityId);
    }

    return tx.plan.create({
      data: {
        name: input.name,
        slug,
        description: normalizeOptionalString(input.description),
        benefits: normalizeBenefits(input.benefits),
        modalityId: input.modalityId ?? null,
        priceCents: input.priceCents,
        billingIntervalMonths: input.billingIntervalMonths,
        durationMonths: input.durationMonths ?? null,
        sessionsPerWeek: input.sessionsPerWeek ?? null,
        isUnlimited: input.isUnlimited ?? false,
        enrollmentFeeCents: input.enrollmentFeeCents,
        active: input.active ?? true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PLAN_CREATED",
    entityType: "Plan",
    entityId: plan.id,
    summary: `Plano ${plan.name} criado.`,
    afterData: {
      slug: plan.slug,
      priceCents: input.priceCents,
      billingIntervalMonths: input.billingIntervalMonths,
    },
  });

  return plan;
}

export async function updatePlan(
  input: UpdatePlanInput,
  context: MutationContext,
) {
  const existing = await prisma.plan.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Plano nao encontrado.");
  }

  if (input.active === false) {
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        planId: input.id,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PENDING,
            SubscriptionStatus.PAUSED,
          ],
        },
      },
    });

    if (activeSubscriptions > 0) {
      throw new ConflictError(
        "Nao e possivel inativar um plano que ainda possui assinaturas vigentes.",
      );
    }
  }

  const plan = await prisma.$transaction(async (tx) => {
    if (input.modalityId) {
      await ensureActiveModality(tx, input.modalityId);
    }

    return tx.plan.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        slug: input.slug ?? existing.slug,
        description: normalizeOptionalString(input.description),
        benefits: normalizeBenefits(input.benefits),
        modalityId: input.modalityId ?? null,
        priceCents: input.priceCents,
        billingIntervalMonths: input.billingIntervalMonths,
        durationMonths: input.durationMonths ?? null,
        sessionsPerWeek: input.sessionsPerWeek ?? null,
        isUnlimited: input.isUnlimited ?? false,
        enrollmentFeeCents: input.enrollmentFeeCents,
        active: input.active ?? true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
      },
    });
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PLAN_UPDATED",
    entityType: "Plan",
    entityId: plan.id,
    summary: `Plano ${plan.name} atualizado.`,
    beforeData: {
      slug: existing.slug,
      active: existing.active,
    },
    afterData: {
      slug: plan.slug,
      active: plan.active,
      priceCents: input.priceCents,
    },
  });

  return plan;
}

export async function archivePlan(
  planId: string,
  context: MutationContext,
) {
  const plan = await prisma.plan.findUnique({
    where: {
      id: planId,
    },
    select: {
      id: true,
      name: true,
      active: true,
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano nao encontrado.");
  }

  const activeSubscriptions = await prisma.subscription.count({
    where: {
      planId,
      status: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PENDING,
          SubscriptionStatus.PAUSED,
        ],
      },
    },
  });

  if (activeSubscriptions > 0) {
    throw new ConflictError(
      "Nao e possivel arquivar um plano com assinaturas vigentes.",
    );
  }

  await prisma.plan.update({
    where: {
      id: planId,
    },
    data: {
      active: false,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PLAN_ARCHIVED",
    entityType: "Plan",
    entityId: plan.id,
    summary: `Plano ${plan.name} arquivado.`,
    beforeData: {
      active: plan.active,
    },
    afterData: {
      active: false,
    },
  });
}

export async function getSubscriptionsIndexData(
  viewer: ViewerContext,
  filters: SubscriptionFiltersInput,
) {
  const where: Prisma.SubscriptionWhereInput = {
    AND: [
      getSubscriptionVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                studentProfile: {
                  user: {
                    name: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                studentProfile: {
                  registrationNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                plan: {
                  name: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {},
      filters.studentId
        ? {
            studentProfileId: filters.studentId,
          }
        : {},
      filters.planId
        ? {
            planId: filters.planId,
          }
        : {},
      filters.status
        ? {
            status: filters.status,
          }
        : {},
      filters.autoRenew === true
        ? {
            autoRenew: true,
          }
        : filters.autoRenew === false
          ? {
              autoRenew: false,
            }
          : {},
      filters.dateFrom || filters.dateTo
        ? {
            startDate: {
              ...(filters.dateFrom ? { gte: parseDateOnly(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: parseDateOnly(filters.dateTo) } : {}),
            },
          }
        : {},
    ],
  };

  const [totalSubscriptions, summaryRows, options] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      select: {
        status: true,
        autoRenew: true,
        priceCents: true,
        discountCents: true,
      },
    }),
    getSubscriptionOptions(viewer),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalSubscriptions,
  });
  const subscriptions = await prisma.subscription.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      renewalDay: true,
      autoRenew: true,
      priceCents: true,
      discountCents: true,
      notes: true,
      createdAt: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          user: {
            select: {
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          active: true,
          priceCents: true,
          billingIntervalMonths: true,
          durationMonths: true,
        },
      },
      checkoutPayment: {
        select: {
          checkoutUrl: true,
          status: true,
        },
      },
      payments: {
        where: {
          status: PaymentStatus.PENDING,
        },
        orderBy: [{ dueDate: "asc" }],
        take: 1,
        select: {
          id: true,
          amountCents: true,
          dueDate: true,
          status: true,
        },
      },
      _count: {
        select: {
          payments: true,
        },
      },
    },
  });

  const summary = {
    totalSubscriptions,
    activeSubscriptions: summaryRows.filter(
      (subscription) => subscription.status === SubscriptionStatus.ACTIVE,
    ).length,
    overdueSubscriptions: summaryRows.filter(
      (subscription) => subscription.status === SubscriptionStatus.PAST_DUE,
    ).length,
    autoRenewSubscriptions: summaryRows.filter(
      (subscription) => subscription.autoRenew,
    ).length,
    recurringRevenueCents: summaryRows
      .filter((subscription) =>
        autoSyncedSubscriptionStatuses.includes(subscription.status),
      )
      .reduce(
        (total, subscription) =>
          total + Math.max(0, subscription.priceCents - subscription.discountCents),
        0,
      ),
  };

  return {
    subscriptions,
    pagination,
    summary,
    options,
    canManage: hasPermission(viewer.role, "manageSubscriptions"),
  };
}

export async function getSubscriptionDetailData(
  viewer: ViewerContext,
  subscriptionId: string,
) {
  await ensureVisibleSubscription(viewer, subscriptionId);

  const subscription = await prisma.subscription.findFirst({
    where: {
      AND: [getSubscriptionVisibilityWhere(viewer), { id: subscriptionId }],
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      renewalDay: true,
      autoRenew: true,
      priceCents: true,
      discountCents: true,
      notes: true,
      createdAt: true,
      cancelledAt: true,
      createdByUser: {
        select: {
          name: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          user: {
            select: {
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          benefits: true,
          priceCents: true,
          billingIntervalMonths: true,
          durationMonths: true,
          active: true,
        },
      },
      checkoutPayment: {
        select: {
          checkoutUrl: true,
          status: true,
        },
      },
      payments: {
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          amountCents: true,
          status: true,
          method: true,
          dueDate: true,
          paidAt: true,
          description: true,
        },
      },
      _count: {
        select: {
          payments: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new NotFoundError("Assinatura nao encontrada.");
  }

  return {
    subscription,
    options: await getSubscriptionOptions(viewer),
    canManage: hasPermission(viewer.role, "manageSubscriptions"),
  };
}

export async function createSubscription(
  input: CreateSubscriptionInput,
  context: MutationContext,
) {
  const startDate = parseDateOnly(input.startDate)!;

  const result = await prisma.$transaction(async (tx) => {
    const student = await ensureStudentExists(tx, input.studentProfileId);
    const plan = await ensurePlanExists(tx, input.planId);

    if (!plan.active) {
      throw new ConflictError("Selecione um plano ativo para criar a assinatura.");
    }

    if (student.status === StudentStatus.INACTIVE || !student.user.isActive) {
      throw new ConflictError(
        "Nao e possivel criar assinatura para um aluno inativo.",
      );
    }

    const endDate =
      parseDateOnly(input.endDate) ??
      addMonths(startDate, buildPlanRecurrenceMonths(plan));

    const subscription = await tx.subscription.create({
      data: {
        studentProfileId: input.studentProfileId,
        planId: input.planId,
        status: input.status,
        startDate,
        endDate,
        renewalDay: input.renewalDay ?? startDate.getUTCDate(),
        autoRenew: input.autoRenew ?? false,
        priceCents: input.priceCents ?? plan.priceCents,
        discountCents: input.discountCents ?? 0,
        notes: normalizeOptionalString(input.notes),
        createdByUserId: context.viewer.userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (autoSyncedSubscriptionStatuses.includes(input.status)) {
      await syncSubscriptionFinancialStatus(tx, subscription.id);
    }

    return subscription;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "SUBSCRIPTION_CREATED",
    entityType: "Subscription",
    entityId: result.id,
    summary: "Assinatura criada.",
    afterData: {
      studentProfileId: input.studentProfileId,
      planId: input.planId,
      status: input.status,
      autoRenew: input.autoRenew ?? false,
    },
  });

  return result;
}

export async function updateSubscription(
  input: UpdateSubscriptionInput,
  context: MutationContext,
) {
  const existing = await prisma.subscription.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      planId: true,
      status: true,
      startDate: true,
      endDate: true,
      autoRenew: true,
      priceCents: true,
      discountCents: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Assinatura nao encontrada.");
  }

  const startDate = parseDateOnly(input.startDate)!;

  const subscription = await prisma.$transaction(async (tx) => {
    const student = await ensureStudentExists(tx, input.studentProfileId);
    const plan = await ensurePlanExists(tx, input.planId);

    if (!plan.active && plan.id !== existing.planId) {
      throw new ConflictError("Selecione um plano ativo.");
    }

    if (student.status === StudentStatus.INACTIVE || !student.user.isActive) {
      throw new ConflictError(
        "Nao e possivel manter assinatura em um aluno inativo.",
      );
    }

    const updated = await tx.subscription.update({
      where: {
        id: input.id,
      },
      data: {
        studentProfileId: input.studentProfileId,
        planId: input.planId,
        status: input.status,
        startDate,
        endDate:
          parseDateOnly(input.endDate) ??
          addMonths(startDate, buildPlanRecurrenceMonths(plan)),
        renewalDay: input.renewalDay ?? startDate.getUTCDate(),
        autoRenew:
          input.status === SubscriptionStatus.CANCELLED
            ? false
            : (input.autoRenew ?? false),
        priceCents: input.priceCents ?? plan.priceCents,
        discountCents: input.discountCents ?? 0,
        notes: normalizeOptionalString(input.notes),
        cancelledAt:
          input.status === SubscriptionStatus.CANCELLED ? new Date() : null,
      },
      select: {
        id: true,
        status: true,
        autoRenew: true,
      },
    });

    if (autoSyncedSubscriptionStatuses.includes(input.status)) {
      await syncSubscriptionFinancialStatus(tx, updated.id);
    }

    return updated;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "SUBSCRIPTION_UPDATED",
    entityType: "Subscription",
    entityId: subscription.id,
    summary: "Assinatura atualizada.",
    beforeData: {
      status: existing.status,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate?.toISOString() ?? null,
      autoRenew: existing.autoRenew,
      priceCents: existing.priceCents,
      discountCents: existing.discountCents,
    },
    afterData: {
      status: subscription.status,
      autoRenew: subscription.autoRenew,
      planId: input.planId,
      studentProfileId: input.studentProfileId,
      priceCents: input.priceCents,
      discountCents: input.discountCents,
    },
  });

  return subscription;
}

export async function cancelSubscription(
  subscriptionId: string,
  context: MutationContext,
) {
  const existing = await prisma.subscription.findUnique({
    where: {
      id: subscriptionId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Assinatura nao encontrada.");
  }

  const subscription = await prisma.subscription.update({
    where: {
      id: subscriptionId,
    },
    data: {
      status: SubscriptionStatus.CANCELLED,
      autoRenew: false,
      cancelledAt: new Date(),
    },
    select: {
      id: true,
      status: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "SUBSCRIPTION_CANCELLED",
    entityType: "Subscription",
    entityId: subscription.id,
    summary: "Assinatura cancelada.",
    beforeData: {
      status: existing.status,
    },
    afterData: {
      status: subscription.status,
    },
  });

  return subscription;
}

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
                  user: {
                    name: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                studentProfile: {
                  registrationNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.studentId
        ? {
            studentProfileId: filters.studentId,
          }
        : {},
      filters.subscriptionId
        ? {
            subscriptionId: filters.subscriptionId,
          }
        : {},
      buildPaymentStatusWhere(filters.status, today) ?? {},
      buildPaymentMethodWhere(filters.method as PaymentMethodFilter | undefined) ?? {},
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
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const summary = summaryRows.reduce(
    (accumulator, payment) => {
      const overdue = isPaymentOverdue(payment.status, payment.dueDate, today);

      accumulator.totalPayments += 1;

      if (payment.status === PaymentStatus.PAID) {
        accumulator.paidPayments += 1;
        accumulator.receivedCents += payment.amountCents;
      }

      if (payment.status === PaymentStatus.PENDING) {
        accumulator.pendingPayments += 1;
        accumulator.outstandingCents += payment.amountCents;
      }

      if (overdue) {
        accumulator.overduePayments += 1;
        accumulator.overdueCents += payment.amountCents;
        accumulator.delinquentStudentIds.add(payment.studentProfileId);
      }

      return accumulator;
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
    where: {
      AND: [getPaymentVisibilityWhere(viewer), { id: paymentId }],
    },
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
      createdByUser: {
        select: {
          name: true,
        },
      },
      processedByUser: {
        select: {
          name: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          plan: {
            select: {
              id: true,
              name: true,
              active: true,
            },
          },
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
        {
          subscriptionId: payment.subscription.id,
          id: {
            not: payment.id,
          },
        },
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
    await ensureSubscriptionForStudent(
      tx,
      input.subscriptionId,
      input.studentProfileId,
    );
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
      select: {
        id: true,
        status: true,
      },
    });

    await syncSubscriptionFinancialStatus(tx, input.subscriptionId);

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
    where: {
      id: input.id,
    },
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
    await ensureSubscriptionForStudent(
      tx,
      input.subscriptionId,
      input.studentProfileId,
    );
    await ensureNoDuplicatePayment(tx, {
      paymentId: input.id,
      studentProfileId: input.studentProfileId,
      subscriptionId: input.subscriptionId,
      dueDate,
    });

    const updated = await tx.payment.update({
      where: {
        id: input.id,
      },
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
      select: {
        id: true,
        status: true,
        amountCents: true,
        dueDate: true,
      },
    });

    await syncSubscriptionFinancialStatus(tx, input.subscriptionId);

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

export async function cancelPayment(
  paymentId: string,
  context: MutationContext,
) {
  const existing = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    select: {
      id: true,
      status: true,
      subscriptionId: true,
    },
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
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.CANCELLED,
        paidAt: null,
        processedByUserId: null,
      },
      select: {
        id: true,
        status: true,
      },
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
    beforeData: {
      status: existing.status,
    },
    afterData: {
      status: payment.status,
    },
  });

  return payment;
}

export async function getStudentFinancialSnapshot(viewer: ViewerContext) {
  if (!viewer.studentProfileId) {
    return null;
  }

  const today = startOfDay();

  const [activeSubscription, nextPayment, recentPayments] = await prisma.$transaction([
    prisma.subscription.findFirst({
      where: {
        studentProfileId: viewer.studentProfileId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PENDING,
            SubscriptionStatus.PAUSED,
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        autoRenew: true,
        renewalDay: true,
        priceCents: true,
        discountCents: true,
        plan: {
          select: {
            id: true,
            name: true,
            priceCents: true,
            billingIntervalMonths: true,
          },
        },
      },
    }),
    prisma.payment.findFirst({
      where: {
        studentProfileId: viewer.studentProfileId,
        status: PaymentStatus.PENDING,
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        amountCents: true,
        dueDate: true,
        status: true,
        method: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        studentProfileId: viewer.studentProfileId,
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        amountCents: true,
        status: true,
        method: true,
        dueDate: true,
        paidAt: true,
        description: true,
      },
    }),
  ]);

  const hasOverdueOpenPayment = nextPayment
    ? isPaymentOverdue(nextPayment.status, nextPayment.dueDate, today)
    : false;

  return {
    activeSubscription,
    nextPayment,
    recentPayments,
    financialStatus:
      hasOverdueOpenPayment ||
      activeSubscription?.status === SubscriptionStatus.PAST_DUE
        ? "inadimplente"
        : nextPayment
          ? "em_dia"
          : "sem_cobranca_aberta",
  };
}

export async function getFinancialOverviewData(viewer: ViewerContext) {
  const where = getPaymentVisibilityWhere(viewer);
  const today = startOfDay();

  const [pendingPayments, overduePayments, activeSubscriptions] =
    await prisma.$transaction([
      prisma.payment.aggregate({
        where: {
          AND: [where, { status: PaymentStatus.PENDING }],
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountCents: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          AND: [
            where,
            {
              status: PaymentStatus.PENDING,
              dueDate: {
                lt: today,
              },
            },
          ],
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountCents: true,
        },
      }),
      prisma.subscription.count({
        where: {
          AND: [
            getSubscriptionVisibilityWhere(viewer),
            {
              status: {
                in: [
                  SubscriptionStatus.ACTIVE,
                  SubscriptionStatus.PAST_DUE,
                  SubscriptionStatus.PENDING,
                ],
              },
            },
          ],
        },
      }),
    ]);

  return {
    pendingPayments: pendingPayments._count._all,
    pendingAmountCents: pendingPayments._sum.amountCents ?? 0,
    overduePayments: overduePayments._count._all,
    overdueAmountCents: overduePayments._sum.amountCents ?? 0,
    activeSubscriptions,
  };
}
