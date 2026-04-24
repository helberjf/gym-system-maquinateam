import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseCategory, UserRole } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    payment: { aggregate: vi.fn(), findMany: vi.fn() },
    productSale: { aggregate: vi.fn(), findMany: vi.fn() },
    order: { aggregate: vi.fn(), findMany: vi.fn() },
    checkoutPayment: { aggregate: vi.fn() },
    expense: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { getDreReport } from "@/lib/reports/dre";

const adminViewer = {
  userId: "user-admin",
  role: UserRole.ADMIN,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const receptionViewer = {
  userId: "user-recep",
  role: UserRole.RECEPCAO,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.payment.aggregate.mockResolvedValue({
    _sum: { amountCents: 100000 },
  });
  mocks.prisma.productSale.aggregate.mockResolvedValue({
    _sum: { totalCents: 20000 },
  });
  mocks.prisma.order.aggregate.mockResolvedValue({
    _sum: { totalCents: 30000 },
  });
  mocks.prisma.checkoutPayment.aggregate.mockResolvedValue({
    _sum: { amountCents: 5000 },
  });
  mocks.prisma.expense.groupBy.mockResolvedValue([
    { category: ExpenseCategory.MP_FEE, _sum: { amountCents: 4500 } },
    { category: ExpenseCategory.RENT, _sum: { amountCents: 250000 } },
    { category: ExpenseCategory.MARKETING, _sum: { amountCents: 30000 } },
  ]);
  mocks.prisma.expense.findMany.mockResolvedValue([]);
  mocks.prisma.payment.findMany.mockResolvedValue([]);
  mocks.prisma.productSale.findMany.mockResolvedValue([]);
  mocks.prisma.order.findMany.mockResolvedValue([]);
});

describe("getDreReport access", () => {
  it("rejects viewers without viewFinancialReports", async () => {
    await expect(
      getDreReport(receptionViewer, {}),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getDreReport aggregation", () => {
  it("sums revenue streams, subtracts refunds, fees, expenses", async () => {
    const report = await getDreReport(adminViewer, {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });

    expect(report.revenue.subscriptionsCents).toBe(100000);
    expect(report.revenue.internalSalesCents).toBe(20000);
    expect(report.revenue.storeOrdersCents).toBe(30000);
    expect(report.revenue.grossCents).toBe(150000);
    expect(report.revenue.refundsCents).toBe(5000);
    expect(report.revenue.netCents).toBe(145000);
    expect(report.feesCents).toBe(4500);
    expect(report.manualExpensesCents).toBe(280000);
    expect(report.totalExpensesCents).toBe(284500);
    expect(report.grossProfitCents).toBe(140500);
    expect(report.resultCents).toBe(145000 - 284500);
  });

  it("returns top expenses filtered by manual categories", async () => {
    mocks.prisma.expense.findMany.mockResolvedValueOnce([
      {
        id: "exp-1",
        description: "Aluguel",
        category: ExpenseCategory.RENT,
        amountCents: 250000,
        incurredAt: new Date("2026-04-05"),
      },
    ]);

    const report = await getDreReport(adminViewer, {});

    expect(mocks.prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { not: ExpenseCategory.MP_FEE },
        }),
      }),
    );
    expect(report.topExpenses).toHaveLength(1);
    expect(report.topExpenses[0].category).toBe(ExpenseCategory.RENT);
  });

  it("uses cash regime (paidAt) for payments and orders", async () => {
    await getDreReport(adminViewer, {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });

    expect(mocks.prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PAID",
          paidAt: expect.any(Object),
        }),
      }),
    );
    expect(mocks.prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: "PAID",
          paidAt: expect.any(Object),
        }),
      }),
    );
  });

  it("defaults refunds and totals to zero when no data", async () => {
    mocks.prisma.payment.aggregate.mockResolvedValueOnce({
      _sum: { amountCents: null },
    });
    mocks.prisma.productSale.aggregate.mockResolvedValueOnce({
      _sum: { totalCents: null },
    });
    mocks.prisma.order.aggregate.mockResolvedValueOnce({
      _sum: { totalCents: null },
    });
    mocks.prisma.checkoutPayment.aggregate.mockResolvedValueOnce({
      _sum: { amountCents: null },
    });
    mocks.prisma.expense.groupBy.mockResolvedValueOnce([]);

    const report = await getDreReport(adminViewer, {});

    expect(report.revenue.grossCents).toBe(0);
    expect(report.revenue.netCents).toBe(0);
    expect(report.totalExpensesCents).toBe(0);
    expect(report.resultCents).toBe(0);
  });
});
