import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";

const mocks = vi.hoisted(() => {
  const tx = {
    subscription: {
      findUnique: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      subscription: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  ensureNextRecurringPaymentForSubscription,
  generateRecurringSubscriptionPayments,
  getNextBillingDueDate,
} from "@/lib/billing/recurrence";

function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    studentProfileId: "profile-1",
    status: SubscriptionStatus.ACTIVE,
    startDate: new Date("2026-05-04T00:00:00.000Z"),
    autoRenew: true,
    renewalDay: 4,
    priceCents: 9900,
    discountCents: 1000,
    checkoutPayment: {
      method: PaymentMethod.PIX,
    },
    plan: {
      name: "Plano Mensal",
      billingIntervalMonths: 1,
    },
    ...overrides,
  };
}

describe("recurring payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.subscription.findUnique.mockResolvedValue(buildSubscription());
    mocks.tx.payment.findFirst.mockResolvedValue(null);
    mocks.tx.payment.create.mockResolvedValue({ id: "pay-next" });
    mocks.prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => fn(mocks.tx),
    );
  });

  it("clamps monthly billing dates to the last day of short months", () => {
    const dueDate = getNextBillingDueDate(
      new Date("2026-01-31T00:00:00.000Z"),
      1,
      31,
    );

    expect(dueDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("creates the next pending monthly payment from the paid plan amount", async () => {
    mocks.tx.payment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        dueDate: new Date("2026-05-04T00:00:00.000Z"),
        method: PaymentMethod.PIX,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await ensureNextRecurringPaymentForSubscription(mocks.tx, {
      subscriptionId: "sub-1",
    });

    expect(result).toEqual({ id: "pay-next", created: true });
    expect(mocks.tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentProfileId: "profile-1",
          subscriptionId: "sub-1",
          amountCents: 8900,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.PIX,
          dueDate: new Date("2026-06-04T00:00:00.000Z"),
          externalReference: "REC-sub-1-2026-06-04",
        }),
      }),
    );
  });

  it("does not stack a new charge while one is already pending", async () => {
    mocks.tx.payment.findFirst.mockResolvedValueOnce({ id: "open-pay" });

    const result = await ensureNextRecurringPaymentForSubscription(mocks.tx, {
      subscriptionId: "sub-1",
    });

    expect(result).toBeNull();
    expect(mocks.tx.payment.create).not.toHaveBeenCalled();
  });

  it("backfills recurring charges through the cron helper", async () => {
    mocks.prisma.subscription.findMany.mockResolvedValue([
      { id: "sub-1" },
      { id: "sub-2" },
    ]);
    mocks.tx.payment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        dueDate: new Date("2026-05-04T00:00:00.000Z"),
        method: PaymentMethod.PIX,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "already-open" });

    const result = await generateRecurringSubscriptionPayments();

    expect(result).toEqual({ checked: 2, created: 1 });
  });
});
