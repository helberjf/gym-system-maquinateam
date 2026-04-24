import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProductStatus,
  SubscriptionStatus,
} from "@prisma/client";

// ─── mocks before any imports ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const tx = {
    checkoutPayment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    coupon: {
      update: vi.fn(),
    },
    couponRedemption: {
      delete: vi.fn(),
    },
    subscription: {
      update: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(),
    },
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  syncPlanCheckoutPayment,
  syncStoreCheckoutPayment,
} from "@/lib/payments/checkout-sync";

// ─── fixtures ─────────────────────────────────────────────────────────────────

const SYNC_INPUT_PAID = {
  checkoutPaymentId: "cp-1",
  provider: PaymentProvider.MERCADO_PAGO,
  providerObjectId: "mp-999",
  paymentStatus: PaymentStatus.PAID,
  paymentMethod: PaymentMethod.CREDIT_CARD,
  paymentDetails: { id: "mp-999" },
};

const SYNC_INPUT_FAILED = {
  ...SYNC_INPUT_PAID,
  paymentStatus: PaymentStatus.FAILED,
};

const SYNC_INPUT_CANCELLED = {
  ...SYNC_INPUT_PAID,
  paymentStatus: PaymentStatus.CANCELLED,
};

function buildStoreCheckoutPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-1",
    paidAt: null,
    refundedAt: null,
    externalReference: "STORE-ABC",
    order: {
      id: "order-1",
      status: OrderStatus.PENDING,
      paidAt: null,
      cancelledAt: null,
      inventoryRestoredAt: null,
      couponId: null,
      couponRedemption: null,
      items: [],
    },
    ...overrides,
  };
}

function buildPlanCheckoutPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-1",
    paidAt: null,
    refundedAt: null,
    amountCents: 9900,
    externalReference: "PLAN-ABC",
    subscription: {
      id: "sub-1",
      status: SubscriptionStatus.PENDING,
      cancelledAt: null,
      notes: null,
      studentProfileId: "profile-1",
      plan: {
        id: "plan-1",
        name: "Plano Mensal",
      },
    },
    ...overrides,
  };
}

function setupTx() {
  mocks.prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => fn(mocks.tx),
  );
}

// ─── syncStoreCheckoutPayment ─────────────────────────────────────────────────

describe("syncStoreCheckoutPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTx();
    mocks.tx.checkoutPayment.update.mockResolvedValue({});
    mocks.tx.order.update.mockResolvedValue({});
    mocks.tx.product.findUnique.mockResolvedValue({ status: ProductStatus.ACTIVE });
    mocks.tx.product.findMany.mockResolvedValue([]);
    mocks.tx.product.update.mockResolvedValue({});
    mocks.tx.product.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.inventoryMovement.create.mockResolvedValue({});
    mocks.tx.inventoryMovement.createMany.mockResolvedValue({ count: 0 });
    mocks.tx.coupon.update.mockResolvedValue({});
    mocks.tx.couponRedemption.delete.mockResolvedValue({});
  });

  it("returns early and does nothing when checkout payment is not found", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(null);

    await syncStoreCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.checkoutPayment.update).not.toHaveBeenCalled();
  });

  it("updates checkout payment with PAID status and sets paidAt", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment(),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.checkoutPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cp-1" },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          paidAt: expect.any(Date),
          failureReason: null,
        }),
      }),
    );
  });

  it("transitions order to PAID status when payment is approved", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment(),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
        }),
      }),
    );
  });

  it("transitions order to CANCELLED when payment fails", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment(),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_FAILED);

    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does NOT restore inventory when payment is approved", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: null,
          couponId: null,
          couponRedemption: null,
          items: [{ productId: "p1", quantity: 2 }],
        },
      }),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.product.update).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("restores inventory for each item when payment is cancelled", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: null,
          couponId: null,
          couponRedemption: null,
          items: [
            { productId: "p1", quantity: 2 },
            { productId: "p2", quantity: 1 },
          ],
        },
      }),
    );
    mocks.tx.product.findMany.mockResolvedValue([
      { id: "p1", status: ProductStatus.ACTIVE },
      { id: "p2", status: ProductStatus.ACTIVE },
    ]);

    await syncStoreCheckoutPayment(SYNC_INPUT_CANCELLED);

    expect(mocks.tx.product.update).toHaveBeenCalledTimes(2);
    expect(mocks.tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ stockQuantity: { increment: 2 } }),
      }),
    );
    expect(mocks.tx.inventoryMovement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ productId: "p1", quantityDelta: 2 }),
          expect.objectContaining({ productId: "p2", quantityDelta: 1 }),
        ]),
      }),
    );
  });

  it("reverts OUT_OF_STOCK back to ACTIVE when restoring inventory", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: null,
          couponId: null,
          couponRedemption: null,
          items: [{ productId: "p1", quantity: 1 }],
        },
      }),
    );
    mocks.tx.product.findMany.mockResolvedValue([
      { id: "p1", status: ProductStatus.OUT_OF_STOCK },
    ]);

    await syncStoreCheckoutPayment(SYNC_INPUT_CANCELLED);

    expect(mocks.tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["p1"] } },
        data: expect.objectContaining({ status: ProductStatus.ACTIVE }),
      }),
    );
  });

  it("does not restore inventory when inventoryRestoredAt is already set", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: new Date(), // already restored
          couponId: null,
          couponRedemption: null,
          items: [{ productId: "p1", quantity: 1 }],
        },
      }),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_FAILED);

    expect(mocks.tx.product.update).not.toHaveBeenCalled();
  });

  it("decrements coupon usageCount and deletes redemption when order is cancelled", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: null,
          couponId: "coupon-1",
          couponRedemption: { id: "redemption-1" },
          items: [],
        },
      }),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_FAILED);

    expect(mocks.tx.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "coupon-1" },
        data: { usageCount: { decrement: 1 } },
      }),
    );
    expect(mocks.tx.couponRedemption.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "redemption-1" },
      }),
    );
  });

  it("does not touch coupon when order was paid successfully", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildStoreCheckoutPayment({
        order: {
          id: "order-1",
          status: OrderStatus.PENDING,
          paidAt: null,
          cancelledAt: null,
          inventoryRestoredAt: null,
          couponId: "coupon-1",
          couponRedemption: { id: "redemption-1" },
          items: [],
        },
      }),
    );

    await syncStoreCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.coupon.update).not.toHaveBeenCalled();
    expect(mocks.tx.couponRedemption.delete).not.toHaveBeenCalled();
  });
});

// ─── syncPlanCheckoutPayment ──────────────────────────────────────────────────

describe("syncPlanCheckoutPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTx();
    mocks.tx.checkoutPayment.update.mockResolvedValue({});
    mocks.tx.subscription.update.mockResolvedValue({});
    mocks.tx.payment.findFirst.mockResolvedValue(null);
    mocks.tx.payment.create.mockResolvedValue({});
    mocks.tx.payment.update.mockResolvedValue({});
  });

  it("returns early when checkout payment is not found", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(null);

    await syncPlanCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.subscription.update).not.toHaveBeenCalled();
  });

  it("activates subscription when payment is approved", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment(),
    );

    await syncPlanCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          cancelledAt: null,
        }),
      }),
    );
  });

  it("creates a new Payment record when none exists for this external reference", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment(),
    );
    mocks.tx.payment.findFirst.mockResolvedValue(null);

    await syncPlanCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: "sub-1",
          status: PaymentStatus.PAID,
          amountCents: 9900,
          externalReference: "PLAN-ABC",
          gatewayTransactionId: "mp-999",
        }),
      }),
    );
    expect(mocks.tx.payment.update).not.toHaveBeenCalled();
  });

  it("updates existing Payment record when one already exists for this external reference", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment(),
    );
    mocks.tx.payment.findFirst.mockResolvedValue({ id: "pay-existing" });

    await syncPlanCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-existing" },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          gatewayTransactionId: "mp-999",
        }),
      }),
    );
    expect(mocks.tx.payment.create).not.toHaveBeenCalled();
  });

  it("cancels a PENDING subscription when payment fails", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment({
        subscription: {
          id: "sub-1",
          status: SubscriptionStatus.PENDING,
          cancelledAt: null,
          notes: null,
          studentProfileId: "profile-1",
          plan: { id: "plan-1", name: "Plano Mensal" },
        },
      }),
    );

    await syncPlanCheckoutPayment(SYNC_INPUT_FAILED);

    expect(mocks.tx.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does not cancel an already-active subscription on failed payment", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment({
        subscription: {
          id: "sub-1",
          status: SubscriptionStatus.ACTIVE, // already active
          cancelledAt: null,
          notes: null,
          studentProfileId: "profile-1",
          plan: { id: "plan-1", name: "Plano Mensal" },
        },
      }),
    );

    await syncPlanCheckoutPayment(SYNC_INPUT_FAILED);

    // should NOT call subscription.update for status change
    const subUpdateCalls = mocks.tx.subscription.update.mock.calls;
    expect(subUpdateCalls).toHaveLength(0);
  });

  it("updates checkout payment with PAID and sets paidAt on approval", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment(),
    );

    await syncPlanCheckoutPayment(SYNC_INPUT_PAID);

    expect(mocks.tx.checkoutPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cp-1" },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          paidAt: expect.any(Date),
          providerPaymentId: "mp-999",
        }),
      }),
    );
  });

  it("records failureReason on the checkout payment when payment fails", async () => {
    mocks.tx.checkoutPayment.findUnique.mockResolvedValue(
      buildPlanCheckoutPayment(),
    );

    await syncPlanCheckoutPayment(SYNC_INPUT_FAILED);

    const cpUpdate = mocks.tx.checkoutPayment.update.mock.calls[0]?.[0];
    expect(cpUpdate?.data?.failureReason).toMatch(/recusado|nao autorizado/i);
  });
});
