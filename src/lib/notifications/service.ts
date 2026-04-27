import {
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  TrainingAssignmentStatus,
  UserRole,
} from "@prisma/client";
import type { ViewerContext } from "@/lib/academy/access";
import { endOfDay, startOfDay } from "@/lib/academy/constants";
import { prisma } from "@/lib/prisma";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  tone: "info" | "warning" | "danger" | "success";
  createdAt: Date;
};

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function notificationSort(
  left: DashboardNotification,
  right: DashboardNotification,
) {
  const priority = { danger: 4, warning: 3, info: 2, success: 1 };
  const priorityDiff = priority[right.tone] - priority[left.tone];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return right.createdAt.getTime() - left.createdAt.getTime();
}

async function getAnnouncementNotifications(viewer: ViewerContext) {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      isPublished: true,
      publishedAt: { lte: now },
      OR: [{ targetRole: null }, { targetRole: viewer.role }],
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 4,
    select: {
      id: true,
      title: true,
      excerpt: true,
      isPinned: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return announcements.map((announcement): DashboardNotification => ({
    id: `announcement:${announcement.id}`,
    title: announcement.isPinned ? `Fixado: ${announcement.title}` : announcement.title,
    message: announcement.excerpt ?? "Novo comunicado disponivel no painel.",
    href: `/dashboard/avisos/${announcement.id}`,
    tone: announcement.isPinned ? "warning" : "info",
    createdAt: announcement.publishedAt ?? announcement.createdAt,
  }));
}

async function getStudentNotifications(viewer: ViewerContext) {
  if (!viewer.studentProfileId) {
    return [];
  }

  const today = startOfDay();
  const nextWeek = endOfDay(addDays(today, 7));
  const [payments, trainings] = await Promise.all([
    prisma.payment.findMany({
      where: {
        studentProfileId: viewer.studentProfileId,
        status: PaymentStatus.PENDING,
        dueDate: { lte: nextWeek },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 3,
      select: {
        id: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        subscription: { select: { plan: { select: { name: true } } } },
      },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        studentProfileId: viewer.studentProfileId,
        status: {
          in: [
            TrainingAssignmentStatus.ASSIGNED,
            TrainingAssignmentStatus.IN_PROGRESS,
          ],
        },
        dueAt: { lte: nextWeek },
      },
      orderBy: [{ dueAt: "asc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        dueAt: true,
        createdAt: true,
      },
    }),
  ]);

  return [
    ...payments.map((payment): DashboardNotification => {
      const overdue = Boolean(payment.dueDate && payment.dueDate < today);
      return {
        id: `payment:${payment.id}`,
        title: overdue ? "Pagamento vencido" : "Pagamento proximo",
        message: `${payment.subscription.plan.name} - R$ ${(payment.amountCents / 100).toFixed(2)}`,
        href: "/dashboard/pagamentos",
        tone: overdue ? "danger" : "warning",
        createdAt: payment.dueDate ?? payment.createdAt,
      };
    }),
    ...trainings.map((training): DashboardNotification => ({
      id: `training:${training.id}`,
      title: "Treino pendente",
      message: training.dueAt
        ? `${training.title} vence em ${training.dueAt.toISOString().slice(0, 10)}`
        : training.title,
      href: "/dashboard/treinos",
      tone: "info",
      createdAt: training.dueAt ?? training.createdAt,
    })),
  ];
}

async function getStaffNotifications(viewer: ViewerContext) {
  const today = startOfDay();
  const openOrderStatuses = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
  ];

  const [
    overduePayments,
    lowStockProducts,
    openOrders,
    failedWebhooks,
  ] = await Promise.all([
    prisma.payment.count({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: { lt: today },
      },
    }),
    prisma.product.count({
      where: {
        trackInventory: true,
        status: { not: ProductStatus.ARCHIVED },
        stockQuantity: { lte: 3 },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: openOrderStatuses },
      },
    }),
    viewer.role === UserRole.ADMIN
      ? prisma.webhookEvent.count({
          where: {
            processed: true,
            error: { not: null },
          },
        })
      : Promise.resolve(0),
  ]);

  const notifications: DashboardNotification[] = [];

  if (overduePayments > 0) {
    notifications.push({
      id: "staff:overdue-payments",
      title: "Inadimplencia ativa",
      message: `${overduePayments} cobranca(s) vencida(s).`,
      href: "/dashboard/relatorios",
      tone: "danger",
      createdAt: today,
    });
  }

  if (lowStockProducts > 0) {
    notifications.push({
      id: "staff:low-stock",
      title: "Estoque baixo",
      message: `${lowStockProducts} produto(s) precisam de revisao.`,
      href: "/dashboard/produtos",
      tone: "warning",
      createdAt: today,
    });
  }

  if (openOrders > 0) {
    notifications.push({
      id: "staff:open-orders",
      title: "Pedidos em andamento",
      message: `${openOrders} pedido(s) ainda no fluxo operacional.`,
      href: "/dashboard/pedidos-loja",
      tone: "info",
      createdAt: today,
    });
  }

  if (failedWebhooks > 0) {
    notifications.push({
      id: "staff:failed-webhooks",
      title: "Webhooks com erro",
      message: `${failedWebhooks} evento(s) financeiro(s) exigem conferencia.`,
      href: "/dashboard/admin",
      tone: "danger",
      createdAt: today,
    });
  }

  return notifications;
}

export async function getDashboardNotifications(viewer: ViewerContext) {
  const [announcements, scopedNotifications] = await Promise.all([
    getAnnouncementNotifications(viewer),
    viewer.role === UserRole.ALUNO
      ? getStudentNotifications(viewer)
      : getStaffNotifications(viewer),
  ]);

  return [...scopedNotifications, ...announcements]
    .sort(notificationSort)
    .slice(0, 8);
}
