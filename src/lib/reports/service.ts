import type { z } from "zod";
import {
  AttendanceStatus,
  PaymentStatus,
  ProductStatus,
  SaleStatus,
  StudentStatus,
  UserRole,
} from "@prisma/client";
import {
  getAttendanceVisibilityWhere,
  getModalityVisibilityWhere,
  getStudentVisibilityWhere,
  getTeacherVisibilityWhere,
  type ViewerContext,
} from "@/lib/academy/access";
import { endOfDay, startOfDay } from "@/lib/academy/constants";
import { getPaymentVisibilityWhere } from "@/lib/billing/access";
import { getProductSaleVisibilityWhere, getProductVisibilityWhere } from "@/lib/commerce/access";
import { isLowStockProduct } from "@/lib/commerce/constants";
import { ForbiddenError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildCsv, type ReportTable } from "@/lib/reports/exporters";
import {
  reportExportKindSchema,
  reportFiltersSchema,
} from "@/lib/validators";

type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
type ReportExportKind = z.infer<typeof reportExportKindSchema>;

type ResolvedReportRange = {
  dateFrom: Date;
  dateTo: Date;
};

type ChartPoint = {
  label: string;
  value: number;
  note?: string;
};

function ensureReportsAccess(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "viewReports")) {
    throw new ForbiddenError("Acesso negado aos relatorios.");
  }
}

function parseDateOnly(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return startOfDay(value);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, amount: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value;
}

function addMonths(date: Date, amount: number) {
  const value = new Date(date);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value;
}

function getMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function formatDateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveReportRange(filters: ReportFiltersInput): ResolvedReportRange {
  const today = startOfDay();
  const dateTo = parseDateOnly(filters.dateTo) ?? today;
  const dateFrom = parseDateOnly(filters.dateFrom) ?? addDays(dateTo, -29);

  return {
    dateFrom,
    dateTo: endOfDay(dateTo),
  };
}

function buildEmptySeries(range: ResolvedReportRange) {
  const points: ChartPoint[] = [];
  const current = startOfDay(range.dateFrom);
  const lastDay = startOfDay(range.dateTo);

  while (current <= lastDay) {
    points.push({
      label: formatDayLabel(current),
      value: 0,
      note: current.toISOString().slice(0, 10),
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return points;
}

function buildMonthlySeries(referenceDate = new Date(), totalMonths = 6) {
  const endMonth = getMonthStart(referenceDate);
  const startMonth = addMonths(endMonth, -(totalMonths - 1));
  const points: ChartPoint[] = [];

  for (let index = 0; index < totalMonths; index += 1) {
    const monthDate = addMonths(startMonth, index);
    points.push({
      label: formatMonthLabel(monthDate),
      value: 0,
      note: monthDate.toISOString().slice(0, 7),
    });
  }

  return points;
}

async function getReportOptions(viewer: ViewerContext) {
  const [students, modalities, teachers] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where: getStudentVisibilityWhere(viewer),
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        registrationNumber: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.modality.findMany({
      where: {
        AND: [getModalityVisibilityWhere(viewer), { isActive: true }],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.teacherProfile.findMany({
      where: {
        AND: [getTeacherVisibilityWhere(viewer), { isActive: true }],
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return { students, modalities, teachers };
}

async function loadAttendanceDataset(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
  range: ResolvedReportRange,
) {
  const records = await prisma.attendance.findMany({
    where: {
      AND: [
        getAttendanceVisibilityWhere(viewer),
        {
          classDate: {
            gte: range.dateFrom,
            lte: range.dateTo,
          },
        },
        filters.studentId
          ? {
              studentProfileId: filters.studentId,
            }
          : {},
        filters.modalityId
          ? {
              classSchedule: {
                modalityId: filters.modalityId,
              },
            }
          : {},
        filters.teacherId
          ? {
              classSchedule: {
                teacherProfileId: filters.teacherId,
              },
            }
          : {},
      ],
    },
    orderBy: [{ classDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      classDate: true,
      status: true,
      checkedInAt: true,
      checkedOutAt: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      classSchedule: {
        select: {
          id: true,
          title: true,
          modality: {
            select: {
              id: true,
              name: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const attendanceByDate = buildEmptySeries(range);
  const attendanceMap = new Map(
    attendanceByDate.map((point) => [point.note as string, point]),
  );
  const byStudentMap = new Map<string, { label: string; value: number; note: string }>();
  const byModalityMap = new Map<string, { label: string; value: number; note: string }>();
  const byTeacherMap = new Map<string, { label: string; value: number; note: string }>();

  let presentCount = 0;
  let noShowCount = 0;

  for (const record of records) {
    const dateKey = record.classDate.toISOString().slice(0, 10);
    const isPresent =
      record.status === AttendanceStatus.CHECKED_IN ||
      record.status === AttendanceStatus.CHECKED_OUT;
    const isNoShow = record.status === AttendanceStatus.NO_SHOW;

    if (isPresent) {
      presentCount += 1;
    }

    if (isNoShow) {
      noShowCount += 1;
    }

    const seriesPoint = attendanceMap.get(dateKey);
    if (seriesPoint && isPresent) {
      seriesPoint.value += 1;
    }

    if (isPresent) {
      const studentEntry = byStudentMap.get(record.studentProfile.id) ?? {
        label: record.studentProfile.user.name,
        value: 0,
        note: record.studentProfile.registrationNumber,
      };
      studentEntry.value += 1;
      byStudentMap.set(record.studentProfile.id, studentEntry);

      const modalityEntry = byModalityMap.get(record.classSchedule.modality.id) ?? {
        label: record.classSchedule.modality.name,
        value: 0,
        note: "presencas",
      };
      modalityEntry.value += 1;
      byModalityMap.set(record.classSchedule.modality.id, modalityEntry);

      const teacherEntry = byTeacherMap.get(record.classSchedule.teacherProfile.id) ?? {
        label: record.classSchedule.teacherProfile.user.name,
        value: 0,
        note: "presencas",
      };
      teacherEntry.value += 1;
      byTeacherMap.set(record.classSchedule.teacherProfile.id, teacherEntry);
    }
  }

  return {
    records,
    summary: {
      totalRecords: records.length,
      presentCount,
      noShowCount,
      uniqueStudents: new Set(records.map((record) => record.studentProfile.id)).size,
    },
    charts: {
      byDate: attendanceByDate,
      byStudent: Array.from(byStudentMap.values()).sort((a, b) => b.value - a.value).slice(0, 8),
      byModality: Array.from(byModalityMap.values()).sort((a, b) => b.value - a.value).slice(0, 6),
      byTeacher: Array.from(byTeacherMap.values()).sort((a, b) => b.value - a.value).slice(0, 6),
    },
  };
}

async function loadPaymentDataset(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
  range: ResolvedReportRange,
) {
  const today = startOfDay();
  const records = await prisma.payment.findMany({
    where: {
      AND: [
        getPaymentVisibilityWhere(viewer),
        {
          OR: [
            {
              dueDate: {
                gte: range.dateFrom,
                lte: range.dateTo,
              },
            },
            {
              paidAt: {
                gte: range.dateFrom,
                lte: range.dateTo,
              },
            },
          ],
        },
        filters.studentId
          ? {
              studentProfileId: filters.studentId,
            }
          : {},
        filters.modalityId
          ? {
              studentProfile: {
                primaryModalityId: filters.modalityId,
              },
            }
          : {},
        filters.teacherId
          ? {
              studentProfile: {
                responsibleTeacherId: filters.teacherId,
              },
            }
          : {},
      ],
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      amountCents: true,
      status: true,
      method: true,
      dueDate: true,
      paidAt: true,
      description: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          primaryModality: {
            select: {
              id: true,
              name: true,
            },
          },
          responsibleTeacher: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      subscription: {
        select: {
          id: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const revenueByDate = buildEmptySeries(range);
  const revenueMap = new Map(revenueByDate.map((point) => [point.note as string, point]));
  const delinquencyMap = new Map<
    string,
    {
      studentName: string;
      registrationNumber: string;
      overdueCount: number;
      overdueAmountCents: number;
      oldestDueDate: Date | null;
      modalityName: string | null;
      teacherName: string | null;
    }
  >();

  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let paidAmountCents = 0;
  let pendingAmountCents = 0;
  let overdueAmountCents = 0;

  for (const record of records) {
    const isOverdue =
      record.status === PaymentStatus.PENDING &&
      Boolean(record.dueDate && record.dueDate < today);

    if (record.status === PaymentStatus.PAID) {
      paidCount += 1;
      paidAmountCents += record.amountCents;

      if (record.paidAt) {
        const paidDateKey = record.paidAt.toISOString().slice(0, 10);
        const seriesPoint = revenueMap.get(paidDateKey);

        if (seriesPoint) {
          seriesPoint.value += record.amountCents;
        }
      }
    }

    if (record.status === PaymentStatus.PENDING) {
      pendingCount += 1;
      pendingAmountCents += record.amountCents;
    }

    if (isOverdue) {
      overdueCount += 1;
      overdueAmountCents += record.amountCents;

      const existingStudent = delinquencyMap.get(record.studentProfile.id) ?? {
        studentName: record.studentProfile.user.name,
        registrationNumber: record.studentProfile.registrationNumber,
        overdueCount: 0,
        overdueAmountCents: 0,
        oldestDueDate: null,
        modalityName: record.studentProfile.primaryModality?.name ?? null,
        teacherName: record.studentProfile.responsibleTeacher?.user.name ?? null,
      };

      existingStudent.overdueCount += 1;
      existingStudent.overdueAmountCents += record.amountCents;

      if (
        record.dueDate &&
        (!existingStudent.oldestDueDate || record.dueDate < existingStudent.oldestDueDate)
      ) {
        existingStudent.oldestDueDate = record.dueDate;
      }

      delinquencyMap.set(record.studentProfile.id, existingStudent);
    }
  }

  return {
    records,
    summary: {
      totalRecords: records.length,
      paidCount,
      pendingCount,
      overdueCount,
      paidAmountCents,
      pendingAmountCents,
      overdueAmountCents,
      delinquentStudents: delinquencyMap.size,
    },
    charts: {
      revenueByDate,
    },
    delinquency: Array.from(delinquencyMap.values()).sort(
      (left, right) => right.overdueAmountCents - left.overdueAmountCents,
    ),
  };
}

async function loadSalesDataset(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
  range: ResolvedReportRange,
) {
  const sales = await prisma.productSale.findMany({
    where: {
      AND: [
        getProductSaleVisibilityWhere(viewer),
        {
          soldAt: {
            gte: range.dateFrom,
            lte: range.dateTo,
          },
        },
        filters.studentId
          ? {
              studentProfileId: filters.studentId,
            }
          : {},
        filters.modalityId
          ? {
              studentProfile: {
                primaryModalityId: filters.modalityId,
              },
            }
          : {},
        filters.teacherId
          ? {
              studentProfile: {
                responsibleTeacherId: filters.teacherId,
              },
            }
          : {},
      ],
    },
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      saleNumber: true,
      status: true,
      paymentMethod: true,
      totalCents: true,
      soldAt: true,
      customerName: true,
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      soldByUser: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          lineTotalCents: true,
          product: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      },
    },
  });

  const revenueByDate = buildEmptySeries(range);
  const revenueMap = new Map(revenueByDate.map((point) => [point.note as string, point]));
  const topProductsMap = new Map<
    string,
    { label: string; value: number; note: string; revenueCents: number }
  >();

  let paidSales = 0;
  let totalItems = 0;
  let totalRevenueCents = 0;

  for (const sale of sales) {
    if (sale.status === SaleStatus.PAID) {
      paidSales += 1;
      totalRevenueCents += sale.totalCents;
      const soldDateKey = sale.soldAt.toISOString().slice(0, 10);
      const seriesPoint = revenueMap.get(soldDateKey);

      if (seriesPoint) {
        seriesPoint.value += sale.totalCents;
      }
    }

    for (const item of sale.items) {
      totalItems += item.quantity;
      const productEntry = topProductsMap.get(item.product.id) ?? {
        label: item.product.name,
        value: 0,
        note: item.product.category,
        revenueCents: 0,
      };
      productEntry.value += item.quantity;
      productEntry.revenueCents += item.lineTotalCents;
      topProductsMap.set(item.product.id, productEntry);
    }
  }

  return {
    sales,
    summary: {
      totalSales: sales.length,
      paidSales,
      totalItems,
      totalRevenueCents,
    },
    charts: {
      revenueByDate,
      topProducts: Array.from(topProductsMap.values())
        .sort((left, right) => right.revenueCents - left.revenueCents)
        .slice(0, 8)
        .map((product) => ({
          label: product.label,
          value: product.revenueCents,
          note: `${product.value} item(ns)`,
        })),
    },
  };
}

async function loadLowStockDataset(viewer: ViewerContext) {
  const products = await prisma.product.findMany({
    where: {
      AND: [
        getProductVisibilityWhere(viewer),
        {
          trackInventory: true,
          status: {
            not: ProductStatus.ARCHIVED,
          },
        },
      ],
    },
    orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      stockQuantity: true,
      lowStockThreshold: true,
      status: true,
      trackInventory: true,
      priceCents: true,
    },
  });

  return products.filter((product) => isLowStockProduct(product));
}

export async function getAdminDashboardData(viewer: ViewerContext) {
  ensureReportsAccess(viewer);

  if (viewer.role !== UserRole.ADMIN) {
    throw new ForbiddenError("Acesso restrito ao dashboard administrativo.");
  }

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const revenueMonths = buildMonthlySeries(now, 6);
  const attendanceMonths = buildMonthlySeries(now, 6);
  const attendanceDays = buildEmptySeries({
    dateFrom: addDays(today, -6),
    dateTo: endOfDay(today),
  });
  const revenueMap = new Map(revenueMonths.map((point) => [point.note as string, point]));
  const attendanceMonthMap = new Map(
    attendanceMonths.map((point) => [point.note as string, point]),
  );
  const attendanceMap = new Map(attendanceDays.map((point) => [point.note as string, point]));

  const [
    totalStudents,
    activeStudents,
    delinquentPayments,
    attendanceToday,
    pendingPayments,
    paidPaymentsThisMonth,
    products,
    recentTrainings,
    recentStudents,
    recentPayments,
    recentSales,
    recentAuditLogs,
    paymentsForChart,
    attendancesForMonthlyChart,
    attendancesForChart,
  ] = await prisma.$transaction([
    prisma.studentProfile.count({
      where: getStudentVisibilityWhere(viewer),
    }),
    prisma.studentProfile.count({
      where: {
        AND: [
          getStudentVisibilityWhere(viewer),
          {
            status: {
              in: [StudentStatus.ACTIVE, StudentStatus.TRIAL],
            },
          },
        ],
      },
    }),
    prisma.payment.findMany({
      where: {
        AND: [
          getPaymentVisibilityWhere(viewer),
          {
            status: PaymentStatus.PENDING,
            dueDate: {
              lt: today,
            },
          },
        ],
      },
      distinct: ["studentProfileId"],
      select: {
        studentProfileId: true,
      },
    }),
    prisma.attendance.count({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: today,
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
    }),
    prisma.payment.aggregate({
      where: {
        AND: [getPaymentVisibilityWhere(viewer), { status: PaymentStatus.PENDING }],
      },
      _count: {
        _all: true,
      },
      _sum: {
        amountCents: true,
      },
    }),
    prisma.payment.aggregate({
      where: {
        AND: [
          getPaymentVisibilityWhere(viewer),
          {
            status: PaymentStatus.PAID,
            paidAt: {
              gte: monthStart,
              lte: endOfDay(now),
            },
          },
        ],
      },
      _sum: {
        amountCents: true,
      },
    }),
    prisma.product.findMany({
      where: {
        AND: [
          getProductVisibilityWhere(viewer),
          {
            trackInventory: true,
            status: {
              not: ProductStatus.ARCHIVED,
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        stockQuantity: true,
        lowStockThreshold: true,
        status: true,
        trackInventory: true,
      },
    }),
    prisma.trainingAssignment.findMany({
      orderBy: [{ assignedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        assignedAt: true,
        studentProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        teacherProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: getPaymentVisibilityWhere(viewer),
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        amountCents: true,
        status: true,
        dueDate: true,
        studentProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.productSale.findMany({
      where: getProductSaleVisibilityWhere(viewer),
      orderBy: [{ soldAt: "desc" }],
      take: 8,
      select: {
        id: true,
        saleNumber: true,
        totalCents: true,
        soldAt: true,
        studentProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        customerName: true,
      },
    }),
    prisma.auditLog.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        summary: true,
        createdAt: true,
        actor: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        AND: [
          getPaymentVisibilityWhere(viewer),
          {
            status: PaymentStatus.PAID,
            paidAt: {
              gte: addMonths(monthStart, -5),
              lte: endOfDay(now),
            },
          },
        ],
      },
      select: {
        amountCents: true,
        paidAt: true,
      },
    }),
    prisma.attendance.findMany({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: {
              gte: addMonths(monthStart, -5),
              lte: endOfDay(now),
            },
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
      select: {
        classDate: true,
      },
    }),
    prisma.attendance.findMany({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: {
              gte: addDays(today, -6),
              lte: endOfDay(today),
            },
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
      select: {
        classDate: true,
      },
    }),
  ]);

  for (const payment of paymentsForChart) {
    if (!payment.paidAt) {
      continue;
    }

    const monthKey = payment.paidAt.toISOString().slice(0, 7);
    const monthPoint = revenueMap.get(monthKey);

    if (monthPoint) {
      monthPoint.value += payment.amountCents;
    }
  }

  for (const attendance of attendancesForMonthlyChart) {
    const monthKey = attendance.classDate.toISOString().slice(0, 7);
    const monthPoint = attendanceMonthMap.get(monthKey);

    if (monthPoint) {
      monthPoint.value += 1;
    }
  }

  for (const attendance of attendancesForChart) {
    const dayKey = attendance.classDate.toISOString().slice(0, 10);
    const dayPoint = attendanceMap.get(dayKey);

    if (dayPoint) {
      dayPoint.value += 1;
    }
  }

  return {
    metrics: {
      totalStudents,
      activeStudents,
      delinquentStudents: delinquentPayments.length,
      attendanceToday,
      monthRevenueCents: paidPaymentsThisMonth._sum.amountCents ?? 0,
      pendingPayments: pendingPayments._count._all,
      pendingAmountCents: pendingPayments._sum.amountCents ?? 0,
      lowStockProducts: products.filter((product) => isLowStockProduct(product)).length,
    },
    charts: {
      revenueByMonth: revenueMonths,
      attendanceByMonth: attendanceMonths,
      attendanceByDay: attendanceDays,
    },
    recentTrainings,
    recentStudents,
    recentPayments,
    recentSales,
    recentAuditLogs,
    lowStockProducts: products.filter((product) => isLowStockProduct(product)).slice(0, 8),
  };
}

export async function getReceptionDashboardData(viewer: ViewerContext) {
  ensureReportsAccess(viewer);

  if (viewer.role !== UserRole.RECEPCAO) {
    throw new ForbiddenError("Acesso restrito ao dashboard da recepcao.");
  }

  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);
  const checkInSeries = buildEmptySeries({
    dateFrom: addDays(today, -6),
    dateTo: todayEnd,
  });
  const checkInMap = new Map(checkInSeries.map((point) => [point.note as string, point]));

  const [
    todayCheckIns,
    pendingPayments,
    overdueStudents,
    recentSales,
    recentStudents,
    todayAttendance,
    upcomingPendingPayments,
    attendancesForChart,
  ] = await prisma.$transaction([
    prisma.attendance.count({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: today,
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
    }),
    prisma.payment.aggregate({
      where: {
        AND: [getPaymentVisibilityWhere(viewer), { status: PaymentStatus.PENDING }],
      },
      _count: {
        _all: true,
      },
      _sum: {
        amountCents: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        AND: [
          getPaymentVisibilityWhere(viewer),
          {
            status: PaymentStatus.PENDING,
            dueDate: {
              lt: today,
            },
          },
        ],
      },
      distinct: ["studentProfileId"],
      select: {
        studentProfileId: true,
      },
    }),
    prisma.productSale.findMany({
      where: getProductSaleVisibilityWhere(viewer),
      orderBy: [{ soldAt: "desc" }],
      take: 8,
      select: {
        id: true,
        saleNumber: true,
        totalCents: true,
        soldAt: true,
        studentProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        customerName: true,
      },
    }),
    prisma.studentProfile.findMany({
      where: getStudentVisibilityWhere(viewer),
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: today,
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
      orderBy: [{ checkedInAt: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        classDate: true,
        status: true,
        checkedInAt: true,
        studentProfile: {
          select: {
            registrationNumber: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        classSchedule: {
          select: {
            title: true,
            modality: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        AND: [
          getPaymentVisibilityWhere(viewer),
          {
            status: PaymentStatus.PENDING,
            dueDate: {
              gte: today,
            },
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
      select: {
        id: true,
        amountCents: true,
        dueDate: true,
        studentProfile: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            registrationNumber: true,
          },
        },
        subscription: {
          select: {
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        AND: [
          getAttendanceVisibilityWhere(viewer),
          {
            classDate: {
              gte: addDays(today, -6),
              lte: todayEnd,
            },
            status: {
              in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT],
            },
          },
        ],
      },
      select: {
        classDate: true,
      },
    }),
  ]);

  for (const attendance of attendancesForChart) {
    const dayKey = attendance.classDate.toISOString().slice(0, 10);
    const dayPoint = checkInMap.get(dayKey);

    if (dayPoint) {
      dayPoint.value += 1;
    }
  }

  return {
    metrics: {
      todayCheckIns,
      pendingPayments: pendingPayments._count._all,
      pendingAmountCents: pendingPayments._sum.amountCents ?? 0,
      overdueStudents: overdueStudents.length,
      recentSales: recentSales.length,
      recentRegistrations: recentStudents.length,
    },
    charts: {
      checkInsByDay: checkInSeries,
    },
    todayAttendance,
    upcomingPendingPayments,
    recentSales,
    recentStudents,
  };
}

export async function getReportsPageData(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
) {
  ensureReportsAccess(viewer);

  const range = resolveReportRange(filters);
  const [options, attendance, payments, sales, lowStockProducts] = await Promise.all([
    getReportOptions(viewer),
    loadAttendanceDataset(viewer, filters, range),
    loadPaymentDataset(viewer, filters, range),
    loadSalesDataset(viewer, filters, range),
    loadLowStockDataset(viewer),
  ]);

  return {
    range,
    options,
    attendance,
    payments,
    sales,
    lowStockProducts,
  };
}

export async function exportReportTable(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
  kind: ReportExportKind,
): Promise<ReportTable> {
  ensureReportsAccess(viewer);

  const range = resolveReportRange(filters);

  if (kind === "attendance") {
    const attendance = await loadAttendanceDataset(viewer, filters, range);
    return {
      title: "Relatorio de presenca",
      rows: [
        ["Data", "Status", "Aluno", "Matricula", "Turma", "Modalidade", "Professor"],
        ...attendance.records.map((record) => [
          formatDateTimeLabel(record.classDate),
          record.status,
          record.studentProfile.user.name,
          record.studentProfile.registrationNumber,
          record.classSchedule.title,
          record.classSchedule.modality.name,
          record.classSchedule.teacherProfile.user.name,
        ]),
      ],
    };
  }

  if (kind === "payments") {
    const payments = await loadPaymentDataset(viewer, filters, range);
    return {
      title: "Relatorio de pagamentos",
      rows: [
        [
          "Aluno",
          "Matricula",
          "Plano",
          "Status",
          "Valor",
          "Vencimento",
          "Pagamento",
          "Descricao",
        ],
        ...payments.records.map((payment) => [
          payment.studentProfile.user.name,
          payment.studentProfile.registrationNumber,
          payment.subscription.plan.name,
          payment.status,
          payment.amountCents / 100,
          payment.dueDate ? formatDateTimeLabel(payment.dueDate) : "",
          payment.paidAt ? formatDateTimeLabel(payment.paidAt) : "",
          payment.description ?? "",
        ]),
      ],
    };
  }

  if (kind === "delinquency") {
    const payments = await loadPaymentDataset(viewer, filters, range);
    return {
      title: "Relatorio de inadimplencia",
      rows: [
        [
          "Aluno",
          "Matricula",
          "Modalidade",
          "Professor",
          "Cobrancas em atraso",
          "Valor em atraso",
          "Vencimento mais antigo",
        ],
        ...payments.delinquency.map((entry) => [
          entry.studentName,
          entry.registrationNumber,
          entry.modalityName ?? "",
          entry.teacherName ?? "",
          entry.overdueCount,
          entry.overdueAmountCents / 100,
          entry.oldestDueDate ? formatDateTimeLabel(entry.oldestDueDate) : "",
        ]),
      ],
    };
  }

  if (kind === "sales") {
    const sales = await loadSalesDataset(viewer, filters, range);
    return {
      title: "Relatorio de vendas",
      rows: [
        [
          "Venda",
          "Data",
          "Status",
          "Cliente",
          "Responsavel",
          "Produto",
          "Categoria",
          "Quantidade",
          "Total item",
        ],
        ...sales.sales.flatMap((sale) =>
          sale.items.map((item) => [
            sale.saleNumber,
            formatDateTimeLabel(sale.soldAt),
            sale.status,
            sale.studentProfile?.user.name ?? sale.customerName ?? "Balcao",
            sale.soldByUser.name,
            item.product.name,
            item.product.category,
            item.quantity,
            item.lineTotalCents / 100,
          ]),
        ),
      ],
    };
  }

  const lowStockProducts = await loadLowStockDataset(viewer);
  return {
    title: "Relatorio de estoque baixo",
    rows: [
      ["Produto", "Categoria", "Estoque", "Limite de alerta", "Status"],
      ...lowStockProducts.map((product) => [
        product.name,
        product.category,
        product.stockQuantity,
        product.lowStockThreshold,
        product.status,
      ]),
    ],
  };
}

export async function exportReportCsv(
  viewer: ViewerContext,
  filters: ReportFiltersInput,
  kind: ReportExportKind,
) {
  const table = await exportReportTable(viewer, filters, kind);
  return buildCsv(table.rows);
}
