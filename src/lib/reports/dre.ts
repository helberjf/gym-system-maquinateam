import {
  ExpenseCategory,
  PaymentStatus,
  SaleStatus,
} from "@prisma/client";
import type { z } from "zod";
import type { ViewerContext } from "@/lib/academy/access";
import { endOfDay, startOfDay } from "@/lib/academy/constants";
import { ForbiddenError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { dreFiltersSchema } from "@/lib/validators";

type DreFiltersInput = z.infer<typeof dreFiltersSchema>;

export type DreCategoryBreakdown = {
  category: ExpenseCategory;
  total: number;
};

export type DreMonthlyPoint = {
  label: string;
  monthKey: string;
  revenueCents: number;
  expensesCents: number;
  resultCents: number;
};

export type DreTopExpense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  incurredAt: Date;
};

export type DreReport = {
  period: { from: Date; to: Date };
  revenue: {
    subscriptionsCents: number;
    internalSalesCents: number;
    storeOrdersCents: number;
    grossCents: number;
    refundsCents: number;
    netCents: number;
  };
  feesCents: number;
  grossProfitCents: number;
  expensesByCategory: DreCategoryBreakdown[];
  manualExpensesCents: number;
  totalExpensesCents: number;
  resultCents: number;
  monthlyTrend: DreMonthlyPoint[];
  topExpenses: DreTopExpense[];
};

function parseDateOnly(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function resolveDreRange(filters: DreFiltersInput) {
  const today = startOfDay();
  const fallbackFrom = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const dateFrom = parseDateOnly(filters.dateFrom) ?? fallbackFrom;
  const dateTo = parseDateOnly(filters.dateTo) ?? today;
  return {
    dateFrom: startOfDay(dateFrom),
    dateTo: endOfDay(dateTo),
  };
}

function assertCanView(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "viewFinancialReports")) {
    throw new ForbiddenError("Sem permissao para ver o DRE financeiro.");
  }
}

export async function getDreReport(
  viewer: ViewerContext,
  filters: DreFiltersInput,
): Promise<DreReport> {
  assertCanView(viewer);

  const range = resolveDreRange(filters);

  const [
    subscriptionsAgg,
    internalSalesAgg,
    storeOrdersAgg,
    refundsAgg,
    expensesGrouped,
    topExpenses,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: range.dateFrom, lte: range.dateTo },
      },
    }),
    prisma.productSale.aggregate({
      _sum: { totalCents: true },
      where: {
        status: SaleStatus.PAID,
        soldAt: { gte: range.dateFrom, lte: range.dateTo },
      },
    }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: range.dateFrom, lte: range.dateTo },
      },
    }),
    prisma.checkoutPayment.aggregate({
      _sum: { amountCents: true },
      where: {
        status: PaymentStatus.REFUNDED,
        refundedAt: { gte: range.dateFrom, lte: range.dateTo },
      },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amountCents: true },
      where: {
        incurredAt: { gte: range.dateFrom, lte: range.dateTo },
      },
    }),
    prisma.expense.findMany({
      where: {
        incurredAt: { gte: range.dateFrom, lte: range.dateTo },
        category: { not: ExpenseCategory.MP_FEE },
      },
      orderBy: [{ amountCents: "desc" }, { incurredAt: "desc" }],
      take: 10,
      select: {
        id: true,
        description: true,
        category: true,
        amountCents: true,
        incurredAt: true,
      },
    }),
  ]);

  const subscriptionsCents = subscriptionsAgg._sum.amountCents ?? 0;
  const internalSalesCents = internalSalesAgg._sum.totalCents ?? 0;
  const storeOrdersCents = storeOrdersAgg._sum.totalCents ?? 0;
  const grossCents = subscriptionsCents + internalSalesCents + storeOrdersCents;
  const refundsCents = refundsAgg._sum.amountCents ?? 0;
  const netCents = Math.max(grossCents - refundsCents, 0);

  const expensesByCategory: DreCategoryBreakdown[] = expensesGrouped
    .map((entry) => ({
      category: entry.category,
      total: entry._sum.amountCents ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const feesCents =
    expensesByCategory.find((entry) => entry.category === ExpenseCategory.MP_FEE)
      ?.total ?? 0;
  const manualExpensesCents = expensesByCategory
    .filter((entry) => entry.category !== ExpenseCategory.MP_FEE)
    .reduce((acc, entry) => acc + entry.total, 0);
  const totalExpensesCents = feesCents + manualExpensesCents;
  const grossProfitCents = netCents - feesCents;
  const resultCents = netCents - totalExpensesCents;

  const monthlyTrend = await buildMonthlyTrend(range.dateTo);

  return {
    period: { from: range.dateFrom, to: range.dateTo },
    revenue: {
      subscriptionsCents,
      internalSalesCents,
      storeOrdersCents,
      grossCents,
      refundsCents,
      netCents,
    },
    feesCents,
    grossProfitCents,
    expensesByCategory,
    manualExpensesCents,
    totalExpensesCents,
    resultCents,
    monthlyTrend,
    topExpenses,
  };
}

async function buildMonthlyTrend(reference: Date): Promise<DreMonthlyPoint[]> {
  const monthsToShow = 6;
  const endMonth = startOfUtcMonth(reference);
  const startMonth = addUtcMonths(endMonth, -(monthsToShow - 1));
  const trendStart = startOfDay(startMonth);
  const trendEnd = endOfDay(
    new Date(
      Date.UTC(
        endMonth.getUTCFullYear(),
        endMonth.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    ),
  );

  const [payments, sales, orders, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: trendStart, lte: trendEnd },
      },
      select: { amountCents: true, paidAt: true },
    }),
    prisma.productSale.findMany({
      where: {
        status: SaleStatus.PAID,
        soldAt: { gte: trendStart, lte: trendEnd },
      },
      select: { totalCents: true, soldAt: true },
    }),
    prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: trendStart, lte: trendEnd },
      },
      select: { totalCents: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: {
        incurredAt: { gte: trendStart, lte: trendEnd },
      },
      select: { amountCents: true, incurredAt: true },
    }),
  ]);

  const buckets = new Map<string, DreMonthlyPoint>();
  for (let index = 0; index < monthsToShow; index += 1) {
    const monthDate = addUtcMonths(startMonth, index);
    const key = monthDate.toISOString().slice(0, 7);
    buckets.set(key, {
      label: formatMonthLabel(monthDate),
      monthKey: key,
      revenueCents: 0,
      expensesCents: 0,
      resultCents: 0,
    });
  }

  function monthKeyFromDate(date: Date | null) {
    if (!date) {
      return null;
    }
    return date.toISOString().slice(0, 7);
  }

  for (const payment of payments) {
    const key = monthKeyFromDate(payment.paidAt);
    const bucket = key ? buckets.get(key) : undefined;
    if (bucket) {
      bucket.revenueCents += payment.amountCents;
    }
  }

  for (const sale of sales) {
    const key = monthKeyFromDate(sale.soldAt);
    const bucket = key ? buckets.get(key) : undefined;
    if (bucket) {
      bucket.revenueCents += sale.totalCents;
    }
  }

  for (const order of orders) {
    const key = monthKeyFromDate(order.paidAt);
    const bucket = key ? buckets.get(key) : undefined;
    if (bucket) {
      bucket.revenueCents += order.totalCents;
    }
  }

  for (const expense of expenses) {
    const key = monthKeyFromDate(expense.incurredAt);
    const bucket = key ? buckets.get(key) : undefined;
    if (bucket) {
      bucket.expensesCents += expense.amountCents;
    }
  }

  for (const bucket of buckets.values()) {
    bucket.resultCents = bucket.revenueCents - bucket.expensesCents;
  }

  return Array.from(buckets.values());
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MP_FEE: "Taxas MercadoPago",
  RENT: "Aluguel",
  PAYROLL: "Folha de pagamento",
  MARKETING: "Marketing",
  UTILITIES: "Agua/Luz/Internet",
  INFRASTRUCTURE: "Infraestrutura",
  TAXES: "Impostos",
  SUPPLIES: "Materiais",
  OTHER: "Outros",
};

export const MANUAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.RENT,
  ExpenseCategory.PAYROLL,
  ExpenseCategory.MARKETING,
  ExpenseCategory.UTILITIES,
  ExpenseCategory.INFRASTRUCTURE,
  ExpenseCategory.TAXES,
  ExpenseCategory.SUPPLIES,
  ExpenseCategory.OTHER,
];

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : String(value);
  if (/[",\n;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function formatCentsForCsv(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

export function exportDreCsv(report: DreReport): string {
  const rows: (string | number)[][] = [];
  rows.push([
    "Periodo",
    `${report.period.from.toISOString().slice(0, 10)} a ${report.period.to.toISOString().slice(0, 10)}`,
  ]);
  rows.push([]);
  rows.push(["Linha", "Valor (BRL)"]);
  rows.push([
    "Receita assinaturas",
    formatCentsForCsv(report.revenue.subscriptionsCents),
  ]);
  rows.push([
    "Receita vendas internas",
    formatCentsForCsv(report.revenue.internalSalesCents),
  ]);
  rows.push([
    "Receita loja",
    formatCentsForCsv(report.revenue.storeOrdersCents),
  ]);
  rows.push(["Receita bruta", formatCentsForCsv(report.revenue.grossCents)]);
  rows.push([
    "Estornos",
    formatCentsForCsv(report.revenue.refundsCents),
  ]);
  rows.push(["Receita liquida", formatCentsForCsv(report.revenue.netCents)]);
  rows.push(["Taxas MercadoPago", formatCentsForCsv(report.feesCents)]);
  rows.push(["Lucro bruto", formatCentsForCsv(report.grossProfitCents)]);
  rows.push([
    "Despesas operacionais",
    formatCentsForCsv(report.manualExpensesCents),
  ]);
  rows.push(["Resultado", formatCentsForCsv(report.resultCents)]);
  rows.push([]);
  rows.push(["Categoria", "Total (BRL)"]);
  for (const entry of report.expensesByCategory) {
    rows.push([
      EXPENSE_CATEGORY_LABELS[entry.category],
      formatCentsForCsv(entry.total),
    ]);
  }

  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(";"))
    .join("\n");
}
