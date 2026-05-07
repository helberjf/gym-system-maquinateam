import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckoutPaymentKind,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

// ─── mocks before any imports ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  prisma: {
    checkoutPayment: {
      findFirst: vi.fn(),
    },
  },
  checkAbacatePayPixQrCode: vi.fn(),
  mapAbacatePayPixStatus: vi.fn(),
  syncStoreCheckoutPayment: vi.fn(),
  syncPlanCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/payments/abacatepay", () => ({
  checkAbacatePayPixQrCode: mocks.checkAbacatePayPixQrCode,
  mapAbacatePayPixStatus: mocks.mapAbacatePayPixStatus,
}));

vi.mock("@/lib/payments/checkout-sync", () => ({
  syncStoreCheckoutPayment: mocks.syncStoreCheckoutPayment,
  syncPlanCheckoutPayment: mocks.syncPlanCheckoutPayment,
  toJsonValue: (v: unknown) => v,
}));

import { getPixCheckoutStatus } from "@/lib/payments/pix";

// ─── fixtures ─────────────────────────────────────────────────────────────────

function buildStoredCheckout(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-pix-1",
    kind: CheckoutPaymentKind.STORE_ORDER,
    userId: null,
    status: PaymentStatus.PENDING,
    amountCents: 9900,
    providerPaymentId: "pix-bill-abc",
    rawPayload: {
      status: "ACTIVE",
      brCode: "00020101...",
      brCodeBase64: "base64-qr",
      expiresAt: "2025-06-16T12:00:00Z",
    },
    order: { id: "order-1", orderNumber: "PED-20250615-1234" },
    subscription: null,
    ...overrides,
  };
}

const BASE_PROVIDER_RESPONSE = {
  status: "ACTIVE",
  brCode: "00020101...",
  brCodeBase64: "base64-qr-fresh",
  expiresAt: "2025-06-16T12:00:00Z",
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe("getPixCheckoutStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default: no API key → skip live fetch
    delete process.env.ABACATEPAY_API_KEY;
  });

  // ── access control ───────────────────────────────────────────────────────────

  it("throws NotFoundError when checkout payment does not exist", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(null);

    await expect(
      getPixCheckoutStatus({ checkoutPaymentId: "missing", userId: "user-1" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when payment belongs to a different user", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ userId: "user-A" }),
    );

    await expect(
      getPixCheckoutStatus({ checkoutPaymentId: "cp-pix-1", userId: "user-B" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns payment data for a guest payment (userId null) without user check", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ userId: null }),
    );

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(result.checkoutPaymentId).toBe("cp-pix-1");
  });

  it("returns payment data for a guest checkout URL linked to a newly created user", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ userId: "created-user-1" }),
    );

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(result.checkoutPaymentId).toBe("cp-pix-1");
    expect(result.brCode).toBe("00020101...");
  });

  it("returns payment data when userId matches the stored userId", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ userId: "user-1" }),
    );

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: "user-1",
    });

    expect(result.checkoutPaymentId).toBe("cp-pix-1");
  });

  // ── no live fetch when API key is absent ─────────────────────────────────────

  it("returns stored data without hitting the provider when ABACATEPAY_API_KEY is unset", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(buildStoredCheckout());

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(mocks.checkAbacatePayPixQrCode).not.toHaveBeenCalled();
    expect(result.brCode).toBe("00020101...");
    expect(result.qrCodeImage).toBe("base64-qr");
    expect(result.syncError).toBeNull();
  });

  it("returns stored data without hitting the provider when providerPaymentId is null", async () => {
    process.env.ABACATEPAY_API_KEY = "test-key";
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ providerPaymentId: null }),
    );

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(mocks.checkAbacatePayPixQrCode).not.toHaveBeenCalled();
    expect(result.brCode).toBe("00020101...");
  });

  // ── live fetch: status unchanged ─────────────────────────────────────────────

  it("does not sync when provider status matches stored status", async () => {
    process.env.ABACATEPAY_API_KEY = "test-key";
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(buildStoredCheckout());
    mocks.checkAbacatePayPixQrCode.mockResolvedValue(BASE_PROVIDER_RESPONSE);
    mocks.mapAbacatePayPixStatus.mockReturnValue(PaymentStatus.PENDING); // same as stored

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
    expect(mocks.syncPlanCheckoutPayment).not.toHaveBeenCalled();
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.syncError).toBeNull();
  });

  // ── live fetch: status changed → triggers sync ───────────────────────────────

  it("syncs store order when provider reports approved and stored status is pending", async () => {
    process.env.ABACATEPAY_API_KEY = "test-key";
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({ status: PaymentStatus.PENDING }),
    );
    mocks.checkAbacatePayPixQrCode.mockResolvedValue({
      ...BASE_PROVIDER_RESPONSE,
      status: "PAID",
    });
    mocks.mapAbacatePayPixStatus.mockReturnValue(PaymentStatus.PAID);
    mocks.syncStoreCheckoutPayment.mockResolvedValue(undefined);

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(mocks.syncStoreCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutPaymentId: "cp-pix-1",
        provider: PaymentProvider.ABACATEPAY,
        providerObjectId: "pix-bill-abc",
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.PIX,
      }),
    );
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.syncError).toBeNull();
  });

  it("syncs plan subscription when kind is not STORE_ORDER and status changed", async () => {
    process.env.ABACATEPAY_API_KEY = "test-key";
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({
        kind: CheckoutPaymentKind.PLAN_SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        order: null,
        subscription: { id: "sub-1", plan: { name: "Plano Mensal" } },
      }),
    );
    mocks.checkAbacatePayPixQrCode.mockResolvedValue({
      ...BASE_PROVIDER_RESPONSE,
      status: "PAID",
    });
    mocks.mapAbacatePayPixStatus.mockReturnValue(PaymentStatus.PAID);
    mocks.syncPlanCheckoutPayment.mockResolvedValue(undefined);

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(mocks.syncPlanCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutPaymentId: "cp-pix-1",
        provider: PaymentProvider.ABACATEPAY,
        paymentStatus: PaymentStatus.PAID,
      }),
    );
    expect(mocks.syncStoreCheckoutPayment).not.toHaveBeenCalled();
    expect(result.planName).toBe("Plano Mensal");
  });

  // ── live fetch: provider error ────────────────────────────────────────────────

  it("returns stored data and non-null syncError when provider call throws", async () => {
    process.env.ABACATEPAY_API_KEY = "test-key";
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(buildStoredCheckout());
    mocks.checkAbacatePayPixQrCode.mockRejectedValue(new Error("timeout"));

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(result.status).toBe(PaymentStatus.PENDING); // stored status preserved
    expect(result.syncError).toBe("timeout");
    expect(result.brCode).toBe("00020101..."); // stored brCode still returned
  });

  // ── shape of the returned object ─────────────────────────────────────────────

  it("includes orderId and orderNumber for a STORE_ORDER payment", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(buildStoredCheckout());

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(result.orderId).toBe("order-1");
    expect(result.orderNumber).toBe("PED-20250615-1234");
    expect(result.subscriptionId).toBeNull();
    expect(result.planName).toBeNull();
  });

  it("includes subscriptionId and planName for a PLAN_SUBSCRIPTION payment", async () => {
    mocks.prisma.checkoutPayment.findFirst.mockResolvedValue(
      buildStoredCheckout({
        kind: CheckoutPaymentKind.PLAN_SUBSCRIPTION,
        order: null,
        subscription: { id: "sub-1", plan: { name: "Plano Trimestral" } },
      }),
    );

    const result = await getPixCheckoutStatus({
      checkoutPaymentId: "cp-pix-1",
      userId: null,
    });

    expect(result.subscriptionId).toBe("sub-1");
    expect(result.planName).toBe("Plano Trimestral");
    expect(result.orderId).toBeNull();
    expect(result.orderNumber).toBeNull();
  });
});
