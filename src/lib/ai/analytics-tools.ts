import "server-only";
import {
  AttendanceStatus,
  OrderStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_LIST = 25;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export const ANALYTICS_TOOLS = [
  {
    name: "students_overview",
    description:
      "Quantidade total de alunos por status (ativos, inativos, trial, suspensos, pendentes) e contagem de matriculas em cada plano ativo.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "attendance_for_period",
    description:
      "Resumo de presencas em um intervalo. Retorna contagens por AttendanceStatus e total. Aceita 'today', 'yesterday' ou intervalo dateFrom/dateTo (ISO).",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "range"] },
        dateFrom: { type: "string", description: "Inicio (YYYY-MM-DD)" },
        dateTo: { type: "string", description: "Fim (YYYY-MM-DD)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "revenue_summary",
    description:
      "Soma de pagamentos PAID, total de despesas, e pedidos PAID em um periodo (default: mes corrente). Retorna valores em centavos e formatados em BRL.",
    input_schema: {
      type: "object",
      properties: {
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "overdue_payments",
    description:
      "Lista alunos com pagamentos vencidos (PaymentStatus PENDING + dueDate < hoje). Inclui nome, plano e valor. Limitado a 25.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "low_stock_products",
    description:
      "Lista produtos rastreados com estoque <= threshold (default 3). Inclui nome, SKU e quantidade.",
    input_schema: {
      type: "object",
      properties: {
        threshold: { type: "number", minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "open_orders",
    description:
      "Lista pedidos da loja em status operacional (PENDING/CONFIRMED/PROCESSING/SHIPPED). Limitado a 25.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "leads_pipeline",
    description:
      "Total de leads agrupados por status do funil. Util para responder 'quantos leads em cada estagio'.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "top_classes_by_attendance",
    description:
      "Top 5 turmas (ClassSchedule) com mais check-ins (CHECKED_IN/CHECKED_OUT) nos ultimos 30 dias.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "subscriptions_status",
    description:
      "Quantidade de assinaturas em cada SubscriptionStatus (ACTIVE, PENDING, PAST_DUE, etc.).",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

type ToolName = (typeof ANALYTICS_TOOLS)[number]["name"];

export async function executeAnalyticsTool(
  name: string,
  rawInput: Record<string, unknown> | undefined,
): Promise<{ tool: string; ok: boolean; data?: unknown; error?: string }> {
  const input = rawInput ?? {};
  try {
    switch (name as ToolName) {
      case "students_overview": {
        const grouped = await prisma.studentProfile.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
        const subscriptionsByPlan = await prisma.subscription.groupBy({
          by: ["planId"],
          where: { status: SubscriptionStatus.ACTIVE },
          _count: { _all: true },
        });
        const planIds = subscriptionsByPlan.map((row) => row.planId);
        const plans = await prisma.plan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        });
        const planMap = new Map(plans.map((p) => [p.id, p.name]));
        return {
          tool: name,
          ok: true,
          data: {
            byStatus: Object.fromEntries(
              grouped.map((row) => [row.status, row._count?._all ?? 0]),
            ),
            activePlanCounts: subscriptionsByPlan.map((row) => ({
              planId: row.planId,
              planName: planMap.get(row.planId) ?? row.planId,
              activeSubscribers: row._count._all,
            })),
          },
        };
      }
      case "attendance_for_period": {
        const period = (input.period as string) ?? "today";
        let from: Date;
        let to: Date;
        if (period === "yesterday") {
          to = startOfDay();
          from = startOfDay(new Date(to.getTime() - 24 * 60 * 60 * 1000));
        } else if (period === "range") {
          from = parseDate(input.dateFrom as string, startOfDay());
          to = parseDate(input.dateTo as string, endOfDay());
        } else {
          from = startOfDay();
          to = endOfDay();
        }
        const grouped = await prisma.attendance.groupBy({
          by: ["status"],
          where: { classDate: { gte: from, lt: to } },
          _count: { _all: true },
        });
        const total = grouped.reduce(
          (sum, row) => sum + (row._count?._all ?? 0),
          0,
        );
        return {
          tool: name,
          ok: true,
          data: {
            from: from.toISOString(),
            to: to.toISOString(),
            total,
            byStatus: Object.fromEntries(
              grouped.map((row) => [row.status, row._count?._all ?? 0]),
            ),
          },
        };
      }
      case "revenue_summary": {
        const from = parseDate(input.dateFrom as string, startOfMonth());
        const to = parseDate(input.dateTo as string, endOfMonth());
        const [paymentSum, expenseSum, orderSum] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              status: PaymentStatus.PAID,
              paidAt: { gte: from, lt: to },
            },
            _sum: { amountCents: true },
            _count: { _all: true },
          }),
          prisma.expense.aggregate({
            where: { incurredAt: { gte: from, lt: to } },
            _sum: { amountCents: true },
            _count: { _all: true },
          }),
          prisma.order.aggregate({
            where: {
              status: OrderStatus.PAID,
              paidAt: { gte: from, lt: to },
            },
            _sum: { totalCents: true },
            _count: { _all: true },
          }),
        ]);
        return {
          tool: name,
          ok: true,
          data: {
            period: { from: from.toISOString(), to: to.toISOString() },
            paymentsPaidCents: paymentSum._sum.amountCents ?? 0,
            paymentsCount: paymentSum._count._all,
            expensesCents: expenseSum._sum.amountCents ?? 0,
            expensesCount: expenseSum._count._all,
            storeOrdersPaidCents: orderSum._sum.totalCents ?? 0,
            storeOrdersCount: orderSum._count._all,
            netResultCents:
              (paymentSum._sum.amountCents ?? 0) +
              (orderSum._sum.totalCents ?? 0) -
              (expenseSum._sum.amountCents ?? 0),
          },
        };
      }
      case "overdue_payments": {
        const today = startOfDay();
        const items = await prisma.payment.findMany({
          where: {
            status: PaymentStatus.PENDING,
            dueDate: { lt: today },
          },
          orderBy: { dueDate: "asc" },
          take: MAX_LIST,
          select: {
            id: true,
            amountCents: true,
            dueDate: true,
            studentProfile: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
            subscription: {
              select: { plan: { select: { name: true } } },
            },
          },
        });
        return {
          tool: name,
          ok: true,
          data: {
            count: items.length,
            items: items.map((row) => ({
              paymentId: row.id,
              amountCents: row.amountCents,
              dueDate: row.dueDate?.toISOString() ?? null,
              studentName: row.studentProfile.user.name,
              studentEmail: row.studentProfile.user.email,
              planName: row.subscription.plan.name,
            })),
          },
        };
      }
      case "low_stock_products": {
        const threshold = Math.max(
          0,
          Math.floor(Number(input.threshold ?? 3)),
        );
        const products = await prisma.product.findMany({
          where: {
            trackInventory: true,
            status: { not: "ARCHIVED" },
            stockQuantity: { lte: threshold },
          },
          orderBy: { stockQuantity: "asc" },
          take: MAX_LIST,
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
          },
        });
        return {
          tool: name,
          ok: true,
          data: {
            threshold,
            count: products.length,
            items: products,
          },
        };
      }
      case "open_orders": {
        const items = await prisma.order.findMany({
          where: {
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
              ],
            },
          },
          orderBy: { placedAt: "desc" },
          take: MAX_LIST,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalCents: true,
            placedAt: true,
            customerName: true,
            customerEmail: true,
          },
        });
        return {
          tool: name,
          ok: true,
          data: {
            count: items.length,
            items: items.map((order) => ({
              ...order,
              placedAt: order.placedAt.toISOString(),
            })),
          },
        };
      }
      case "leads_pipeline": {
        const grouped = await prisma.lead.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
        return {
          tool: name,
          ok: true,
          data: Object.fromEntries(
            grouped.map((row) => [row.status, row._count?._all ?? 0]),
          ),
        };
      }
      case "top_classes_by_attendance": {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const grouped = await prisma.attendance.groupBy({
          by: ["classScheduleId"],
          where: {
            classDate: { gte: since },
            status: {
              in: [
                AttendanceStatus.CHECKED_IN,
                AttendanceStatus.CHECKED_OUT,
              ],
            },
          },
          _count: { _all: true },
          orderBy: { _count: { classScheduleId: "desc" } },
          take: 5,
        });
        const ids = grouped
          .map((row) => row.classScheduleId)
          .filter((value): value is string => Boolean(value));
        const schedules = await prisma.classSchedule.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            modality: { select: { name: true } },
            teacherProfile: { select: { user: { select: { name: true } } } },
            startTime: true,
          },
        });
        const map = new Map(schedules.map((s) => [s.id, s]));
        return {
          tool: name,
          ok: true,
          data: grouped
            .filter((row) => row.classScheduleId)
            .map((row) => {
              const schedule = map.get(row.classScheduleId as string);
              return {
                classScheduleId: row.classScheduleId,
                attendanceCount: row._count?._all ?? 0,
                modality: schedule?.modality.name ?? "?",
                teacher: schedule?.teacherProfile?.user.name ?? "?",
                startTime: schedule?.startTime ?? null,
              };
            }),
        };
      }
      case "subscriptions_status": {
        const grouped = await prisma.subscription.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
        return {
          tool: name,
          ok: true,
          data: Object.fromEntries(
            grouped.map((row) => [row.status, row._count?._all ?? 0]),
          ),
        };
      }
      default:
        return {
          tool: name,
          ok: false,
          error: `Tool desconhecida: ${name}`,
        };
    }
  } catch (error) {
    return {
      tool: name,
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao executar tool.",
    };
  }
}

export const ANALYTICS_SYSTEM_PROMPT = `Voce e o assistente analitico da Maquina Team, uma academia.
Responde em portugues do Brasil, de forma direta, com bullets e numeros formatados.
Use as ferramentas disponiveis para buscar dados reais antes de responder.
Valores monetarios estao em centavos: divida por 100 e exiba com R$ X,XX.
Datas vem em ISO; converta para portugues legivel.
Nunca invente numeros: se uma tool retornar count zero ou vazio, diga isso explicitamente.
Em caso de erro de tool, informe o usuario e sugira outra abordagem.
Voce so atende administradores. Nunca compartilhe dados de outros alunos sem necessidade.`;
