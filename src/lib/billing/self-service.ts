import {
  CheckoutPaymentKind,
  PaymentMethod,
  PaymentStatus,
  Plan,
  Prisma,
  StudentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import {
  createAbacatePayPixQrCode,
  formatAbacatePayCellphone,
} from "@/lib/payments/abacatepay";
import {
  buildMercadoPagoReturnUrls,
  createMercadoPagoPreference,
  getMercadoPagoWebhookUrl,
} from "@/lib/payments/mercadopago";
import { resolvePaymentProvider } from "@/lib/payments/provider";
import type { GuestPlanCheckoutInput } from "@/lib/validators/auth";

type MutationContext = {
  userId: string;
  request?: Request;
};

type PlanCheckoutInput = {
  paymentMethod: PaymentMethod;
};

function addMonths(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + amount);
  return nextDate;
}

function buildExternalReference(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${prefix}-${timestamp}-${suffix}`;
}

function buildPlanCheckoutItems(plan: Plan) {
  const items = [
    {
      title: plan.name,
      quantity: 1,
      unit_price: Number((plan.priceCents / 100).toFixed(2)),
      currency_id: "BRL" as const,
    },
  ];

  if (plan.enrollmentFeeCents > 0) {
    items.push({
      title: `Matricula ${plan.name}`,
      quantity: 1,
      unit_price: Number((plan.enrollmentFeeCents / 100).toFixed(2)),
      currency_id: "BRL" as const,
    });
  }

  return items;
}

function buildPlanPixDescription(plan: Plan) {
  return plan.enrollmentFeeCents > 0
    ? `${plan.name} + matricula`
    : `Assinatura ${plan.name}`;
}

function buildPlanPixCustomer(user: Awaited<ReturnType<typeof getSelfServiceUser>>) {
  const document = user.studentProfile?.cpf?.replace(/\D/g, "") ?? "";
  const phone = user.phone?.replace(/\D/g, "") ?? "";

  if (!document || !phone) {
    return undefined;
  }

  return {
    name: user.name.trim(),
    cellphone: formatAbacatePayCellphone(phone),
    email: user.email.trim(),
    taxId: document,
  };
}

async function getSelfServiceUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      studentProfile: {
        select: {
          id: true,
          status: true,
          cpf: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("Sua conta nao foi encontrada.");
  }

  if (!user.studentProfile) {
    throw new ConflictError(
      "Sua conta ainda nao possui um perfil de aluno para contratar planos.",
    );
  }

  if (
    user.studentProfile.status !== StudentStatus.ACTIVE &&
    user.studentProfile.status !== StudentStatus.TRIAL
  ) {
    throw new ConflictError(
      "Sua conta de aluno nao esta ativa. Aguarde a aprovacao ou entre em contato com a equipe.",
    );
  }

  return user;
}

async function getPurchasablePlan(planId: string) {
  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      active: true,
    },
  });

  if (!plan) {
    throw new NotFoundError("Plano nao encontrado ou indisponivel.");
  }

  return plan;
}

async function rollbackFailedPlanCheckout(input: {
  checkoutPaymentId: string;
  subscriptionId: string;
  errorMessage: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.checkoutPayment.update({
      where: {
        id: input.checkoutPaymentId,
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: input.errorMessage,
      },
    });

    await tx.subscription.update({
      where: {
        id: input.subscriptionId,
      },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: "Assinatura cancelada apos falha ao criar o checkout online.",
      },
    });
  });
}

export async function createPlanCheckoutSession(
  planId: string,
  input: PlanCheckoutInput,
  context: MutationContext,
) {
  const [user, plan] = await Promise.all([
    getSelfServiceUser(context.userId),
    getPurchasablePlan(planId),
  ]);
  const studentProfile = user.studentProfile!;
  const paymentProvider = resolvePaymentProvider(input.paymentMethod);

  const conflictingActiveSubscription = await prisma.subscription.findFirst({
    where: {
      studentProfileId: studentProfile.id,
      planId: { not: planId },
      status: {
        in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ],
      },
    },
    select: {
      id: true,
      status: true,
      plan: {
        select: {
          name: true,
        },
      },
    },
  });

  if (conflictingActiveSubscription) {
    throw new ConflictError(
      `Ja existe uma assinatura ativa (${conflictingActiveSubscription.plan.name}). Cancele a assinatura atual antes de contratar outro plano.`,
    );
  }

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      studentProfileId: studentProfile.id,
      planId,
      status: {
        in: [
          SubscriptionStatus.PENDING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ],
      },
    },
    select: {
      id: true,
      status: true,
      plan: {
        select: {
          name: true,
        },
      },
      checkoutPayment: {
        select: {
          id: true,
          status: true,
          checkoutUrl: true,
          externalReference: true,
          method: true,
          provider: true,
        },
      },
    },
  });

  if (
    existingSubscription?.status === SubscriptionStatus.PENDING &&
    existingSubscription.checkoutPayment?.status === PaymentStatus.PENDING &&
    existingSubscription.checkoutPayment.checkoutUrl &&
    existingSubscription.checkoutPayment.method === input.paymentMethod &&
    existingSubscription.checkoutPayment.provider === paymentProvider
  ) {
    return {
      subscriptionId: existingSubscription.id,
      redirectUrl: existingSubscription.checkoutPayment.checkoutUrl,
      reused: true,
    };
  }

  if (
    existingSubscription &&
    existingSubscription.status !== SubscriptionStatus.PENDING
  ) {
    throw new ConflictError(
      `Ja existe uma assinatura em andamento para ${existingSubscription.plan.name}.`,
    );
  }

  const amountCents = plan.priceCents + plan.enrollmentFeeCents;
  const origin = context.request ? new URL(context.request.url).origin : undefined;
  const baseUrl = getAppUrl(origin);
  const returnUrls = buildMercadoPagoReturnUrls({
    successPath: `/planos/sucesso?planId=${plan.id}`,
    failurePath: `/planos/falha?planId=${plan.id}`,
    origin,
  });
  const notificationUrl = getMercadoPagoWebhookUrl(origin);

  const created = await prisma.$transaction(async (tx) => {
    if (existingSubscription?.id && existingSubscription.checkoutPayment?.id) {
      const updated = await tx.checkoutPayment.update({
        where: {
          id: existingSubscription.checkoutPayment.id,
        },
        data: {
          provider: paymentProvider,
          status: PaymentStatus.PENDING,
          method: input.paymentMethod,
          providerPreferenceId: null,
          providerPaymentId: null,
          checkoutUrl: null,
          rawPayload: Prisma.JsonNull,
          failureReason: null,
          paidAt: null,
          refundedAt: null,
          externalReference: buildExternalReference("PLAN"),
        },
        select: {
          id: true,
          externalReference: true,
        },
      });

      return {
        subscriptionId: existingSubscription.id,
        checkoutPaymentId: updated.id,
        externalReference: updated.externalReference,
      };
    }

    const now = new Date();
    const subscription = await tx.subscription.create({
      data: {
        studentProfileId: studentProfile.id,
        planId: plan.id,
        status: SubscriptionStatus.PENDING,
        startDate: now,
        endDate: addMonths(now, plan.durationMonths ?? plan.billingIntervalMonths),
        renewalDay: now.getDate(),
        autoRenew: false,
        priceCents: plan.priceCents,
        discountCents: 0,
        notes: "Assinatura iniciada pelo checkout online.",
        createdByUserId: user.id,
      },
      select: {
        id: true,
      },
    });

    const checkoutPayment = await tx.checkoutPayment.create({
      data: {
        kind: CheckoutPaymentKind.PLAN_SUBSCRIPTION,
        userId: user.id,
        subscriptionId: subscription.id,
        planId: plan.id,
        amountCents,
        externalReference: buildExternalReference("PLAN"),
        status: PaymentStatus.PENDING,
        provider: paymentProvider,
        method: input.paymentMethod,
      },
      select: {
        id: true,
        externalReference: true,
      },
    });

    return {
      subscriptionId: subscription.id,
      checkoutPaymentId: checkoutPayment.id,
      externalReference: checkoutPayment.externalReference,
    };
  });

  try {
    if (paymentProvider === "ABACATEPAY") {
      const pixData = await createAbacatePayPixQrCode({
        amountCents,
        description: buildPlanPixDescription(plan),
        customer: buildPlanPixCustomer(user),
        metadata: {
          checkoutPaymentId: created.checkoutPaymentId,
          subscriptionId: created.subscriptionId,
          planId: plan.id,
          externalReference: created.externalReference,
        },
      });

      if (!pixData.id) {
        throw new ConflictError(
          "A AbacatePay nao retornou um identificador de Pix valido.",
        );
      }

      const redirectUrl = `${baseUrl}/planos/pix?payment=${created.checkoutPaymentId}`;

      await prisma.checkoutPayment.update({
        where: {
          id: created.checkoutPaymentId,
        },
        data: {
          providerPaymentId: pixData.id,
          checkoutUrl: redirectUrl,
          rawPayload: pixData as Prisma.InputJsonValue,
        },
      });

      await logAuditEvent({
        request: context.request,
        actorId: user.id,
        action: "PLAN_CHECKOUT_CREATED",
        entityType: "Subscription",
        entityId: created.subscriptionId,
        summary: `Checkout Pix iniciado para o plano ${plan.name}.`,
        afterData: {
          subscriptionId: created.subscriptionId,
          planId: plan.id,
          amountCents,
          paymentMethod: input.paymentMethod,
          provider: paymentProvider,
        },
      });

      return {
        subscriptionId: created.subscriptionId,
        redirectUrl,
        reused: false,
      };
    }

    const preference = await createMercadoPagoPreference({
      items: buildPlanCheckoutItems(plan),
      externalReference: created.externalReference,
      notificationUrl,
      successUrl: `${returnUrls.successUrl}&subscriptionId=${created.subscriptionId}`,
      pendingUrl: `${returnUrls.pendingUrl}&subscriptionId=${created.subscriptionId}`,
      failureUrl: `${returnUrls.failureUrl}&subscriptionId=${created.subscriptionId}`,
      statementDescriptor:
        process.env.MP_PLAN_STATEMENT_DESCRIPTOR ?? "MAQUINATEAM",
      payer: {
        name: user.name.split(" ")[0],
        surname: user.name.split(" ").slice(1).join(" ") || undefined,
        email: user.email,
      },
      metadata: {
        checkoutPaymentId: created.checkoutPaymentId,
        subscriptionId: created.subscriptionId,
        planId: plan.id,
      },
    });

    await prisma.checkoutPayment.update({
      where: {
        id: created.checkoutPaymentId,
      },
      data: {
        providerPreferenceId: preference.preferenceId,
        checkoutUrl: preference.checkoutUrl,
        rawPayload: preference.rawPayload,
      },
    });

    await logAuditEvent({
      request: context.request,
      actorId: user.id,
      action: "PLAN_CHECKOUT_CREATED",
      entityType: "Subscription",
      entityId: created.subscriptionId,
      summary: `Checkout online iniciado para o plano ${plan.name}.`,
      afterData: {
        subscriptionId: created.subscriptionId,
        planId: plan.id,
        amountCents,
        paymentMethod: input.paymentMethod,
        provider: paymentProvider,
      },
    });

    return {
      subscriptionId: created.subscriptionId,
      redirectUrl: preference.checkoutUrl,
      reused: false,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel iniciar o pagamento do plano.";

    await rollbackFailedPlanCheckout({
      checkoutPaymentId: created.checkoutPaymentId,
      subscriptionId: created.subscriptionId,
      errorMessage: message,
    });

    throw error;
  }
}

export function buildPlanCheckoutSummary(plan: Plan) {
  return {
    amountCents: plan.priceCents + plan.enrollmentFeeCents,
    description:
      plan.enrollmentFeeCents > 0
        ? `${plan.name} + matricula ${formatCurrencyFromCents(plan.enrollmentFeeCents)}`
        : plan.name,
  };
}

function buildGuestRegistrationNumber(userId: string) {
  return `ALU-${userId.slice(-8).toUpperCase()}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createGuestPlanCheckoutSession(
  planId: string,
  input: GuestPlanCheckoutInput,
  context: { request?: Request },
) {
  const plan = await getPurchasablePlan(planId);
  const email = normalizeEmail(input.email);
  const cpf = input.cpf;
  const paymentMethodEnum = input.paymentMethod as PaymentMethod;

  const [existingUser, existingCpfOwner] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true },
    }),
    prisma.studentProfile.findUnique({
      where: { cpf },
      select: { id: true },
    }),
  ]);

  if (existingUser) {
    throw new ConflictError(
      "Ja existe uma conta com esse e-mail. Faca login para assinar.",
    );
  }

  if (existingCpfOwner) {
    throw new ConflictError(
      "Ja existe uma conta com esse CPF. Faca login para assinar.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: "ALUNO",
        phone: normalizeOptionalString(input.phone),
        emailVerified: now,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        registrationNumber: buildGuestRegistrationNumber(user.id),
        status: StudentStatus.ACTIVE,
        cpf,
        joinedAt: now,
      },
    });

    return user;
  });

  await logAuditEvent({
    request: context.request,
    actorId: createdUser.id,
    action: "AUTH_REGISTERED",
    entityType: "User",
    entityId: createdUser.id,
    summary: "Cadastro automatico via guest checkout de plano.",
    afterData: {
      email,
      role: "ALUNO",
      via: "plan-guest-checkout",
      planId: plan.id,
    },
  });

  const checkout = await createPlanCheckoutSession(
    plan.id,
    { paymentMethod: paymentMethodEnum },
    { userId: createdUser.id, request: context.request },
  );

  return {
    ...checkout,
    userId: createdUser.id,
    email: createdUser.email,
  };
}
