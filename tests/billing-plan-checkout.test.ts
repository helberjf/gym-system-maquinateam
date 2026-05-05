import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckoutPaymentKind,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  StudentStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";

// ─── mocks before any imports ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const tx = {
    subscription: {
      create: vi.fn(),
      update: vi.fn(),
    },
    checkoutPayment: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      plan: {
        findFirst: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      checkoutPayment: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    tx,
    createMercadoPagoPreference: vi.fn(),
    createAbacatePayPixQrCode: vi.fn(),
    getMercadoPagoWebhookUrl: vi.fn(),
    buildMercadoPagoReturnUrls: vi.fn(),
    formatAbacatePayCellphone: vi.fn((v: string) => v),
    resolvePaymentProvider: vi.fn(),
    getAppUrl: vi.fn(),
    logAuditEvent: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  createMercadoPagoPreference: mocks.createMercadoPagoPreference,
  getMercadoPagoWebhookUrl: mocks.getMercadoPagoWebhookUrl,
  buildMercadoPagoReturnUrls: mocks.buildMercadoPagoReturnUrls,
}));

vi.mock("@/lib/payments/abacatepay", () => ({
  createAbacatePayPixQrCode: mocks.createAbacatePayPixQrCode,
  formatAbacatePayCellphone: mocks.formatAbacatePayCellphone,
}));

vi.mock("@/lib/payments/provider", () => ({
  resolvePaymentProvider: mocks.resolvePaymentProvider,
}));

vi.mock("@/lib/app-url", () => ({
  getAppUrl: mocks.getAppUrl,
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

import { createPlanCheckoutSession } from "@/lib/billing/self-service";

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PLAN = {
  id: "plan-1",
  name: "Plano Mensal",
  active: true,
  priceCents: 9900,
  enrollmentFeeCents: 0,
  durationMonths: 1,
  billingIntervalMonths: 1,
};

const PLAN_WITH_FEE = {
  ...PLAN,
  enrollmentFeeCents: 5000,
};

const STUDENT_USER = {
  id: "user-1",
  name: "Carlos Lima",
  email: "carlos@email.com",
  phone: "32999990000",
  role: UserRole.ALUNO,
  studentProfile: {
    id: "profile-1",
    status: StudentStatus.ACTIVE,
    cpf: "123.456.789-01",
  },
};

const CONTEXT = { userId: "user-1" };
const INPUT_CREDIT = { paymentMethod: PaymentMethod.CREDIT_CARD };
const INPUT_PIX = { paymentMethod: PaymentMethod.PIX };

const CREATED_SUBSCRIPTION = { id: "sub-1" };
const CREATED_CHECKOUT = { id: "cp-1", externalReference: "PLAN-ABC-XYZ" };

// ─── shared setup helpers ──────────────────────────────────────────────────────

function setupTransactionMock() {
  mocks.prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => {
      mocks.tx.subscription.create.mockResolvedValue(CREATED_SUBSCRIPTION);
      mocks.tx.subscription.update.mockResolvedValue(CREATED_SUBSCRIPTION);
      mocks.tx.checkoutPayment.create.mockResolvedValue(CREATED_CHECKOUT);
      mocks.tx.checkoutPayment.update.mockResolvedValue(CREATED_CHECKOUT);
      return fn(mocks.tx);
    },
  );
}

function setupHappyPathMercadoPago() {
  mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
  mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
  mocks.prisma.subscription.findFirst.mockResolvedValue(null);
  mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
  mocks.getAppUrl.mockReturnValue("https://example.com");
  mocks.getMercadoPagoWebhookUrl.mockReturnValue(
    "https://example.com/api/mercadopago/webhook",
  );
  mocks.buildMercadoPagoReturnUrls.mockReturnValue({
    successUrl: "https://example.com/planos/sucesso?planId=plan-1",
    pendingUrl: "https://example.com/planos/sucesso?planId=plan-1",
    failureUrl: "https://example.com/planos/falha?planId=plan-1",
  });
  mocks.createMercadoPagoPreference.mockResolvedValue({
    preferenceId: "pref-456",
    checkoutUrl: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-456",
    rawPayload: {},
  });
  mocks.prisma.checkoutPayment.update.mockResolvedValue({});
  mocks.logAuditEvent.mockResolvedValue(undefined);
  setupTransactionMock();
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("createPlanCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── user validation ──────────────────────────────────────────────────────────

  it("throws UnauthorizedError when user does not exist", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ConflictError when user has no student profile", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      ...STUDENT_USER,
      studentProfile: null,
    });
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when student profile is inactive", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      ...STUDENT_USER,
      studentProfile: {
        ...STUDENT_USER.studentProfile,
        status: StudentStatus.INACTIVE,
      },
    });
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when student profile is pending (not yet approved)", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      ...STUDENT_USER,
      studentProfile: {
        ...STUDENT_USER.studentProfile,
        status: StudentStatus.PENDING,
      },
    });
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when student profile is suspended", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      ...STUDENT_USER,
      studentProfile: {
        ...STUDENT_USER.studentProfile,
        status: StudentStatus.SUSPENDED,
      },
    });
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows checkout when student profile is TRIAL", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      ...STUDENT_USER,
      studentProfile: {
        ...STUDENT_USER.studentProfile,
        status: StudentStatus.TRIAL,
      },
    });
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.prisma.subscription.findFirst.mockResolvedValue(null);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({
      successUrl: "https://example.com/planos/sucesso?planId=plan-1",
      pendingUrl: "https://example.com/planos/sucesso?planId=plan-1",
      failureUrl: "https://example.com/planos/falha?planId=plan-1",
    });
    mocks.createMercadoPagoPreference.mockResolvedValue({
      preferenceId: "pref-trial",
      checkoutUrl: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-trial",
      rawPayload: {},
    });
    mocks.prisma.checkoutPayment.update.mockResolvedValue({});
    mocks.logAuditEvent.mockResolvedValue(undefined);
    setupTransactionMock();

    const result = await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(result.reused).toBe(false);
    expect(result.redirectUrl).toContain("mercadopago.com");
  });

  // ── plan validation ──────────────────────────────────────────────────────────

  it("throws NotFoundError when plan does not exist or is inactive", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(null);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-missing", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── duplicate subscription guard ─────────────────────────────────────────────

  it("throws ConflictError when an active subscription already exists for this plan", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.prisma.subscription.findFirst.mockResolvedValue({
      id: "sub-existing",
      status: SubscriptionStatus.ACTIVE,
      plan: { name: "Plano Mensal" },
      checkoutPayment: null,
    });
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("reuses existing checkout when a pending subscription + pending payment exists with same method", async () => {
    const existingUrl = "https://www.mercadopago.com/checkout/v1/redirect?pref_id=existing";
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.prisma.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-pending",
        status: SubscriptionStatus.PENDING,
        plan: { name: "Plano Mensal" },
        checkoutPayment: {
          id: "cp-old",
          status: PaymentStatus.PENDING,
          checkoutUrl: existingUrl,
          externalReference: "PLAN-OLD",
          method: PaymentMethod.CREDIT_CARD,
          provider: PaymentProvider.MERCADO_PAGO,
        },
      });
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");

    const result = await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(result.reused).toBe(true);
    expect(result.redirectUrl).toBe(existingUrl);
    expect(mocks.createMercadoPagoPreference).not.toHaveBeenCalled();
  });

  // ── happy path: MercadoPago ───────────────────────────────────────────────────

  it("creates a new subscription and returns a MercadoPago redirectUrl", async () => {
    setupHappyPathMercadoPago();

    const result = await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(result.reused).toBe(false);
    expect(result.subscriptionId).toBe(CREATED_SUBSCRIPTION.id);
    expect(result.redirectUrl).toContain("mercadopago.com");
    expect(mocks.createMercadoPagoPreference).toHaveBeenCalled();
  });

  it("creates online plan subscriptions as recurring without a fixed end date", async () => {
    setupHappyPathMercadoPago();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          autoRenew: true,
          endDate: null,
          priceCents: PLAN.priceCents,
          discountCents: 0,
        }),
      }),
    );
  });

  it("passes correct externalReference and plan items to MercadoPago", async () => {
    setupHappyPathMercadoPago();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.createMercadoPagoPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: CREATED_CHECKOUT.externalReference,
        items: expect.arrayContaining([
          expect.objectContaining({
            title: "Plano Mensal",
            quantity: 1,
          }),
        ]),
      }),
    );
  });

  it("adds enrollment fee as a separate line item when plan has one", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN_WITH_FEE);
    mocks.prisma.subscription.findFirst.mockResolvedValue(null);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.MERCADO_PAGO);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({
      successUrl: "https://example.com/planos/sucesso?planId=plan-1",
      pendingUrl: "https://example.com/planos/sucesso?planId=plan-1",
      failureUrl: "https://example.com/planos/falha?planId=plan-1",
    });
    mocks.createMercadoPagoPreference.mockResolvedValue({
      preferenceId: "pref-fee",
      checkoutUrl: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-fee",
      rawPayload: {},
    });
    mocks.prisma.checkoutPayment.update.mockResolvedValue({});
    mocks.logAuditEvent.mockResolvedValue(undefined);
    setupTransactionMock();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.createMercadoPagoPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ title: "Plano Mensal" }),
          expect.objectContaining({ title: "Matricula Plano Mensal" }),
        ]),
      }),
    );
  });

  it("stores providerPreferenceId and checkoutUrl on the checkout payment record", async () => {
    setupHappyPathMercadoPago();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.prisma.checkoutPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CREATED_CHECKOUT.id },
        data: expect.objectContaining({
          providerPreferenceId: "pref-456",
          checkoutUrl: expect.stringContaining("mercadopago"),
        }),
      }),
    );
  });

  it("creates a CheckoutPayment with PLAN_SUBSCRIPTION kind and correct userId", async () => {
    setupHappyPathMercadoPago();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.tx.checkoutPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: CheckoutPaymentKind.PLAN_SUBSCRIPTION,
          userId: "user-1",
          planId: "plan-1",
        }),
      }),
    );
  });

  it("emits a PLAN_CHECKOUT_CREATED audit event", async () => {
    setupHappyPathMercadoPago();

    await createPlanCheckoutSession("plan-1", INPUT_CREDIT, CONTEXT);

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PLAN_CHECKOUT_CREATED",
        actorId: "user-1",
        entityId: CREATED_SUBSCRIPTION.id,
      }),
    );
  });

  // ── happy path: Pix ───────────────────────────────────────────────────────────

  it("creates a Pix payment via AbacatePay and redirects to /planos/pix", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.prisma.subscription.findFirst.mockResolvedValue(null);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.ABACATEPAY);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.createAbacatePayPixQrCode.mockResolvedValue({
      id: "pix-bill-99",
      status: "ACTIVE",
      brCode: "000201...",
      brCodeBase64: "base64",
    });
    mocks.prisma.checkoutPayment.update.mockResolvedValue({});
    mocks.logAuditEvent.mockResolvedValue(undefined);
    setupTransactionMock();

    const result = await createPlanCheckoutSession("plan-1", INPUT_PIX, CONTEXT);

    expect(result.reused).toBe(false);
    expect(result.redirectUrl).toContain("/planos/pix");
    expect(result.redirectUrl).toContain(CREATED_CHECKOUT.id);
    expect(mocks.createAbacatePayPixQrCode).toHaveBeenCalled();
    expect(mocks.createMercadoPagoPreference).not.toHaveBeenCalled();
  });

  it("throws ConflictError when AbacatePay does not return a valid Pix id", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(STUDENT_USER);
    mocks.prisma.plan.findFirst.mockResolvedValue(PLAN);
    mocks.prisma.subscription.findFirst.mockResolvedValue(null);
    mocks.resolvePaymentProvider.mockReturnValue(PaymentProvider.ABACATEPAY);
    mocks.getAppUrl.mockReturnValue("https://example.com");
    mocks.getMercadoPagoWebhookUrl.mockReturnValue("");
    mocks.buildMercadoPagoReturnUrls.mockReturnValue({});
    mocks.createAbacatePayPixQrCode.mockResolvedValue({
      id: null, // gateway failure
      status: "ERROR",
    });
    // rollback tx
    mocks.prisma.$transaction
      .mockImplementationOnce(
        async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => {
          mocks.tx.subscription.create.mockResolvedValue(CREATED_SUBSCRIPTION);
          mocks.tx.checkoutPayment.create.mockResolvedValue(CREATED_CHECKOUT);
          return fn(mocks.tx);
        },
      )
      .mockImplementationOnce(async () => undefined); // rollback

    await expect(
      createPlanCheckoutSession("plan-1", INPUT_PIX, CONTEXT),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
