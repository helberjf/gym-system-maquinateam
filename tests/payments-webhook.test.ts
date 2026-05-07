import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentMethod, PaymentProvider, PaymentStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    checkoutPayment: {
      findUnique: vi.fn(),
    },
  },
  fetchMercadoPagoPaymentDetails: vi.fn(),
  syncStoreCheckoutPayment: vi.fn(),
  syncPlanCheckoutPayment: vi.fn(),
  recordMercadoPagoFeeForCheckout: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  fetchMercadoPagoPaymentDetails: mocks.fetchMercadoPagoPaymentDetails,
  mapMercadoPagoPaymentStatus: (status: string | null | undefined) => {
    if (status === "approved") return PaymentStatus.PAID;
    if (status === "pending" || status === "in_process") return PaymentStatus.PENDING;
    if (status === "cancelled") return PaymentStatus.CANCELLED;
    return PaymentStatus.FAILED;
  },
  mapMercadoPagoPaymentMethod: (typeId: string | null | undefined) => {
    if (typeId === "pix") return PaymentMethod.PIX;
    if (typeId === "debit_card") return PaymentMethod.DEBIT_CARD;
    return PaymentMethod.CREDIT_CARD;
  },
  getMercadoPagoFinancialSummary: (
    paymentDetails: Record<string, unknown> | null | undefined,
  ) => {
    const txAmount =
      typeof paymentDetails?.transaction_amount === "number"
        ? paymentDetails.transaction_amount
        : 0;
    const txDetails =
      (paymentDetails?.transaction_details as
        | { total_paid_amount?: number; net_received_amount?: number }
        | undefined) ?? {};
    return {
      providerPaymentId:
        paymentDetails?.id !== undefined ? String(paymentDetails.id) : null,
      status: (paymentDetails?.status as string | undefined) ?? null,
      statusDetail: null,
      externalReference:
        (paymentDetails?.external_reference as string | undefined) ?? null,
      paymentType:
        (paymentDetails?.payment_type_id as string | undefined) ?? null,
      paymentMethodId: null,
      currency:
        (paymentDetails?.currency_id as string | undefined) ?? "BRL",
      installments: null,
      approvedAt: null,
      createdAt: null,
      amountCents: Math.round(txAmount * 100),
      totalPaidCents: Math.round((txDetails.total_paid_amount ?? txAmount) * 100),
      netReceivedCents: Math.round((txDetails.net_received_amount ?? 0) * 100),
      installmentAmountCents: 0,
      feeCents: 0,
      feeDetails: [],
    };
  },
}));

vi.mock("@/lib/payments/checkout-sync", () => ({
  syncStoreCheckoutPayment: mocks.syncStoreCheckoutPayment,
  syncPlanCheckoutPayment: mocks.syncPlanCheckoutPayment,
  toJsonValue: (v: unknown) => v,
}));

vi.mock("@/lib/expenses/service", () => ({
  recordMercadoPagoFeeForCheckout: mocks.recordMercadoPagoFeeForCheckout,
}));

import { processMercadoPagoPaymentWebhook } from "@/lib/payments/webhook";

const BASE_PAYMENT_DETAILS = {
  id: 999,
  status: "approved",
  payment_type_id: "credit_card",
  transaction_amount: 150,
  currency_id: "BRL",
  external_reference: "ext-ref-123",
};

const BASE_INPUT = {
  eventType: "payment.updated",
  payload: { data: { id: "999" } },
  providerKey: "mercado_pago:999",
  providerObjectId: "999",
};

describe("processMercadoPagoPaymentWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue(BASE_PAYMENT_DETAILS);

    mocks.prisma.webhookEvent.findUnique.mockResolvedValue(null);
    mocks.prisma.webhookEvent.upsert.mockResolvedValue({ id: "evt-1", processed: false });
    mocks.prisma.webhookEvent.create.mockResolvedValue({ id: "evt-1", processed: false });
    mocks.prisma.webhookEvent.update.mockResolvedValue({ id: "evt-1", processed: true });

    mocks.prisma.checkoutPayment.findUnique.mockResolvedValue({
      id: "cp-1",
      kind: "STORE_ORDER",
      amountCents: 15000,
    });

    mocks.syncStoreCheckoutPayment.mockResolvedValue(undefined);
    mocks.syncPlanCheckoutPayment.mockResolvedValue(undefined);
  });

  it("processes a new store order payment successfully", async () => {
    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(result.received).toBe(true);
    expect(result.checkoutPaymentId).toBe("cp-1");
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(mocks.syncStoreCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutPaymentId: "cp-1",
        provider: PaymentProvider.MERCADO_PAGO,
        providerObjectId: "999",
        paymentStatus: PaymentStatus.PAID,
      }),
    );
    expect(mocks.syncPlanCheckoutPayment).not.toHaveBeenCalled();
  });

  it("processes a plan checkout payment when kind is not STORE_ORDER", async () => {
    mocks.prisma.checkoutPayment.findUnique.mockResolvedValue({
      id: "cp-2",
      kind: "PLAN_SUBSCRIPTION",
      amountCents: 15000,
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(result.received).toBe(true);
    expect(result.checkoutPaymentId).toBe("cp-2");
    expect(mocks.syncPlanCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutPaymentId: "cp-2",
        provider: PaymentProvider.MERCADO_PAGO,
      }),
    );
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
  });

  it("deduplicates: returns dedup=true when event was already processed", async () => {
    mocks.prisma.webhookEvent.upsert.mockResolvedValue({
      id: "evt-1",
      processed: true,
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(result.received).toBe(true);
    expect((result as { dedup?: boolean }).dedup).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
    expect(mocks.syncPlanCheckoutPayment).not.toHaveBeenCalled();
  });

  it("upserts a webhook event using providerKey (idempotent insert)", async () => {
    await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(mocks.prisma.webhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerKey: "mercado_pago:999:PAID" },
        create: expect.objectContaining({
          providerObjectId: "999",
          eventType: "payment.updated",
        }),
        update: expect.objectContaining({
          providerObjectId: "999",
        }),
      }),
    );
  });

  it("treats unique-constraint race as dedup when concurrent webhook claims first", async () => {
    const { Prisma } = await import("@prisma/client");
    const dupErr = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test" },
    );
    mocks.prisma.webhookEvent.upsert.mockRejectedValueOnce(dupErr);
    mocks.prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: "evt-1",
      processed: true,
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect((result as { dedup?: boolean }).dedup).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
  });

  it("marks event as processed=true after successful sync", async () => {
    await processMercadoPagoPaymentWebhook(BASE_INPUT);

    const finalUpdate = mocks.prisma.webhookEvent.update.mock.calls.at(-1);
    expect(finalUpdate?.[0]).toMatchObject({
      where: { id: "evt-1" },
      data: { processed: true, error: null },
    });
  });

  it("ignores payment when external_reference is missing", async () => {
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      external_reference: null,
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(result.received).toBe(true);
    expect((result as { ignored?: boolean }).ignored).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
    expect(mocks.prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it("ignores and marks processed when checkout payment is not found", async () => {
    mocks.prisma.checkoutPayment.findUnique.mockResolvedValue(null);

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(result.received).toBe(true);
    expect((result as { ignored?: boolean }).ignored).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();

    const errorUpdate = mocks.prisma.webhookEvent.update.mock.calls.at(-1);
    expect(errorUpdate?.[0].data.error).toMatch(/ext-ref-123/);
  });

  it("passes correct provider and providerObjectId to sync functions", async () => {
    await processMercadoPagoPaymentWebhook({
      ...BASE_INPUT,
      providerObjectId: "777",
    });

    expect(mocks.syncStoreCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: PaymentProvider.MERCADO_PAGO,
        providerObjectId: "777",
      }),
    );
  });

  it("captures Mercado Pago fees into Expense when payment is approved", async () => {
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      fee_details: [{ type: "mercadopago_fee", amount: 3.5 }],
    });

    await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(mocks.recordMercadoPagoFeeForCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutPaymentId: "cp-1",
        paymentDetails: expect.objectContaining({
          fee_details: expect.any(Array),
        }),
      }),
    );
  });

  it("does not capture fees when payment is not approved", async () => {
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      status: "pending",
    });

    await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect(mocks.recordMercadoPagoFeeForCheckout).not.toHaveBeenCalled();
  });

  it("rejects PAID transition when amount paid diverges from expected (P0 guard)", async () => {
    mocks.prisma.checkoutPayment.findUnique.mockResolvedValue({
      id: "cp-1",
      kind: "STORE_ORDER",
      amountCents: 15000,
    });
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      transaction_amount: 1, // R$ 1.00 vs expected R$ 150.00
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect((result as { divergent?: boolean }).divergent).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
    expect(mocks.recordMercadoPagoFeeForCheckout).not.toHaveBeenCalled();

    const finalUpdate = mocks.prisma.webhookEvent.update.mock.calls.at(-1);
    expect(finalUpdate?.[0].data.error).toMatch(/divergente/i);
  });

  it("rejects PAID transition when currency diverges from BRL (P0 guard)", async () => {
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      currency_id: "USD",
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect((result as { divergent?: boolean }).divergent).toBe(true);
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
  });

  it("allows PENDING transition even when amount has not yet been credited (no guard)", async () => {
    mocks.fetchMercadoPagoPaymentDetails.mockResolvedValue({
      ...BASE_PAYMENT_DETAILS,
      status: "pending",
      transaction_amount: 0,
    });

    const result = await processMercadoPagoPaymentWebhook(BASE_INPUT);

    expect((result as { divergent?: boolean }).divergent).toBeUndefined();
    expect(mocks.syncStoreCheckoutPayment).toHaveBeenCalled();
  });
});
