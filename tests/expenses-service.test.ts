import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseCategory, UserRole } from "@prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    expense: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
  getClientIpFromRequest: vi.fn(() => null),
}));

import {
  createExpense,
  deleteExpense,
  listExpenses,
  recordMercadoPagoFeeForCheckout,
  updateExpense,
} from "@/lib/expenses/service";

const adminViewer = {
  userId: "user-admin",
  role: UserRole.ADMIN,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const professorViewer = {
  userId: "user-prof",
  role: UserRole.PROFESSOR,
  teacherProfileId: "teacher-1",
  studentProfileId: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expenses service access control", () => {
  it("throws when role lacks manageExpenses", async () => {
    await expect(
      listExpenses({ page: 1 }, professorViewer),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("createExpense", () => {
  it("rejects MP_FEE category", async () => {
    await expect(
      createExpense(
        {
          category: ExpenseCategory.MP_FEE,
          description: "Tentativa",
          amountCents: 100,
          incurredAt: "2026-04-01",
        },
        { viewer: adminViewer },
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.prisma.expense.create).not.toHaveBeenCalled();
  });

  it("creates a manual expense and audits", async () => {
    mocks.prisma.expense.create.mockResolvedValue({
      id: "exp-1",
      category: ExpenseCategory.RENT,
      amountCents: 250000,
    });

    const result = await createExpense(
      {
        category: ExpenseCategory.RENT,
        description: "Aluguel abril",
        amountCents: 250000,
        incurredAt: "2026-04-05",
      },
      { viewer: adminViewer },
    );

    expect(result.id).toBe("exp-1");
    expect(mocks.prisma.expense.create).toHaveBeenCalledTimes(1);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expense.create" }),
    );
  });
});

describe("updateExpense", () => {
  it("blocks editing MP_FEE entries", async () => {
    mocks.prisma.expense.findUnique.mockResolvedValue({
      id: "exp-mp",
      category: ExpenseCategory.MP_FEE,
    });

    await expect(
      updateExpense(
        { id: "exp-mp", description: "hack" },
        { viewer: adminViewer },
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.prisma.expense.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when missing", async () => {
    mocks.prisma.expense.findUnique.mockResolvedValue(null);
    await expect(
      updateExpense({ id: "missing" }, { viewer: adminViewer }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteExpense", () => {
  it("blocks deleting MP_FEE entries", async () => {
    mocks.prisma.expense.findUnique.mockResolvedValue({
      id: "exp-mp",
      category: ExpenseCategory.MP_FEE,
    });

    await expect(
      deleteExpense("exp-mp", { viewer: adminViewer }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.prisma.expense.delete).not.toHaveBeenCalled();
  });
});

describe("recordMercadoPagoFeeForCheckout", () => {
  it("skips when payload has no fee_details", async () => {
    const result = await recordMercadoPagoFeeForCheckout({
      checkoutPaymentId: "co-1",
      paidAt: new Date("2026-04-10T12:00:00Z"),
      paymentDetails: { status: "approved" },
    });
    expect(result).toBeNull();
    expect(mocks.prisma.expense.upsert).not.toHaveBeenCalled();
  });

  it("upserts an MP_FEE expense aggregating fee_details", async () => {
    mocks.prisma.expense.upsert.mockResolvedValue({
      id: "exp-fee",
      category: ExpenseCategory.MP_FEE,
      amountCents: 287,
    });

    const result = await recordMercadoPagoFeeForCheckout({
      checkoutPaymentId: "co-2",
      paidAt: new Date("2026-04-10T15:00:00Z"),
      paymentDetails: {
        fee_details: [
          { type: "mercadopago_fee", amount: 2.5 },
          { type: "financing_fee", amount: "0.37" },
        ],
      },
    });

    expect(result?.id).toBe("exp-fee");
    expect(mocks.prisma.expense.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceCheckoutPaymentId: "co-2" },
        create: expect.objectContaining({
          category: ExpenseCategory.MP_FEE,
          amountCents: 287,
        }),
      }),
    );
  });
});
