import type { z } from "zod";
import { CouponDiscountType, Prisma } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { createCouponSchema, couponFiltersSchema, updateCouponSchema } from "@/lib/validators/store";

type CouponFilters = z.infer<typeof couponFiltersSchema>;
type CreateCouponInput = z.infer<typeof createCouponSchema>;
type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

type CouponValidationItem = {
  productId: string;
  category: string;
  quantity: number;
  unitPriceCents: number;
};

type CouponMutationContext = {
  userId: string;
  request?: Request;
};

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

function parseOptionalDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeCouponDiscountValue(input: {
  discountType: CouponDiscountType;
  discountValue: number;
}) {
  if (input.discountType === CouponDiscountType.PERCENTAGE) {
    return Math.round(input.discountValue);
  }

  return Math.round(input.discountValue * 100);
}

export async function getCouponManagementData(filters: CouponFilters) {
  const where: Prisma.CouponWhereInput = {
    ...(filters.q
      ? {
          OR: [
            {
              code: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(filters.active !== "all"
      ? {
          active: filters.active === "true",
        }
      : {}),
  };

  const [totalCoupons, categories] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.product.findMany({
      where: {
        storeVisible: true,
      },
      distinct: ["category"],
      orderBy: {
        category: "asc",
      },
      select: {
        category: true,
      },
    }),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalCoupons,
  });
  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      _count: {
        select: {
          redemptions: true,
          orders: true,
        },
      },
    },
  });

  return {
    coupons,
    pagination,
    categories: categories.map((entry) => entry.category),
  };
}

export async function validateCouponForItems(input: {
  code: string;
  userId?: string | null;
  items: CouponValidationItem[];
  now?: Date;
  db?: Prisma.TransactionClient | typeof prisma;
}) {
  const normalizedCode = normalizeCouponCode(input.code);
  const now = input.now ?? new Date();
  const db = input.db ?? prisma;

  if (!normalizedCode || input.items.length === 0) {
    return {
      ok: false as const,
      message: "Cupom invalido para o carrinho atual.",
    };
  }

  const coupon = await db.coupon.findFirst({
    where: {
      code: normalizedCode,
    },
  });

  if (!coupon || !coupon.active) {
    return {
      ok: false as const,
      message: "Cupom inexistente ou inativo.",
    };
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    return {
      ok: false as const,
      message: "Este cupom ainda nao esta disponivel.",
    };
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    return {
      ok: false as const,
      message: "Este cupom expirou.",
    };
  }

  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return {
      ok: false as const,
      message: "O cupom atingiu o limite total de uso.",
    };
  }

  if (coupon.perUserLimit !== null && input.userId) {
    const redemptionsCount = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId: input.userId,
      },
    });

    if (redemptionsCount >= coupon.perUserLimit) {
      return {
        ok: false as const,
        message: "Voce ja utilizou este cupom no limite permitido.",
      };
    }
  }

  const eligibleItems =
    coupon.eligibleCategories.length > 0
      ? input.items.filter((item) => coupon.eligibleCategories.includes(item.category))
      : input.items;

  if (eligibleItems.length === 0) {
    return {
      ok: false as const,
      message: "Este cupom nao se aplica aos produtos do carrinho.",
    };
  }

  const eligibleSubtotalCents = eligibleItems.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );

  if (
    coupon.minOrderValueCents !== null &&
    eligibleSubtotalCents < coupon.minOrderValueCents
  ) {
    return {
      ok: false as const,
      message: "O carrinho ainda nao atingiu o valor minimo para este cupom.",
    };
  }

  const rawDiscountCents =
    coupon.discountType === CouponDiscountType.PERCENTAGE
      ? Math.round((eligibleSubtotalCents * coupon.discountValue) / 100)
      : coupon.discountValue;
  const discountCents = Math.max(0, Math.min(rawDiscountCents, eligibleSubtotalCents));

  if (discountCents <= 0) {
    return {
      ok: false as const,
      message: "Nao foi possivel aplicar desconto a este carrinho.",
    };
  }

  return {
    ok: true as const,
    coupon,
    discountCents,
    eligibleSubtotalCents,
  };
}

export async function createCoupon(
  input: CreateCouponInput,
  context: CouponMutationContext,
) {
  const normalizedCode = normalizeCouponCode(input.code);
  const startsAt = parseOptionalDateTime(input.startsAt);
  const expiresAt = parseOptionalDateTime(input.expiresAt);

  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new ConflictError("A expiracao deve acontecer apos o inicio da campanha.");
  }

  const existing = await prisma.coupon.findUnique({
    where: {
      code: normalizedCode,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ConflictError("Ja existe um cupom com este codigo.");
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: normalizedCode,
      description: normalizeOptionalString(input.description),
      discountType: input.discountType,
      discountValue: normalizeCouponDiscountValue({
        discountType: input.discountType,
        discountValue: input.discountValue,
      }),
      active: input.active,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      minOrderValueCents: input.minOrderValueCents ?? null,
      eligibleCategories: input.eligibleCategories,
      startsAt,
      expiresAt,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.userId,
    action: "COUPON_CREATED",
    entityType: "Coupon",
    entityId: coupon.id,
    summary: `Cupom ${coupon.code} criado.`,
    afterData: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      active: coupon.active,
      eligibleCategories: coupon.eligibleCategories,
    },
  });

  return coupon;
}

export async function updateCoupon(
  input: UpdateCouponInput,
  context: CouponMutationContext,
) {
  const current = await prisma.coupon.findUnique({
    where: {
      id: input.id,
    },
  });

  if (!current) {
    throw new NotFoundError("Cupom nao encontrado.");
  }

  const normalizedCode = normalizeCouponCode(input.code);
  const startsAt = parseOptionalDateTime(input.startsAt);
  const expiresAt = parseOptionalDateTime(input.expiresAt);

  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new ConflictError("A expiracao deve acontecer apos o inicio da campanha.");
  }

  const duplicatedCode = await prisma.coupon.findFirst({
    where: {
      code: normalizedCode,
      id: {
        not: input.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicatedCode) {
    throw new ConflictError("Ja existe um cupom com este codigo.");
  }

  const coupon = await prisma.coupon.update({
    where: {
      id: input.id,
    },
    data: {
      code: normalizedCode,
      description: normalizeOptionalString(input.description),
      discountType: input.discountType,
      discountValue: normalizeCouponDiscountValue({
        discountType: input.discountType,
        discountValue: input.discountValue,
      }),
      active: input.active,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      minOrderValueCents: input.minOrderValueCents ?? null,
      eligibleCategories: input.eligibleCategories,
      startsAt,
      expiresAt,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.userId,
    action: "COUPON_UPDATED",
    entityType: "Coupon",
    entityId: coupon.id,
    summary: `Cupom ${coupon.code} atualizado.`,
    beforeData: {
      code: current.code,
      discountType: current.discountType,
      discountValue: current.discountValue,
      active: current.active,
    },
    afterData: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      active: coupon.active,
      eligibleCategories: coupon.eligibleCategories,
    },
  });

  return coupon;
}

export async function deactivateCoupon(
  couponId: string,
  context: CouponMutationContext,
) {
  const current = await prisma.coupon.findUnique({
    where: {
      id: couponId,
    },
  });

  if (!current) {
    throw new NotFoundError("Cupom nao encontrado.");
  }

  const coupon = await prisma.coupon.update({
    where: {
      id: couponId,
    },
    data: {
      active: false,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.userId,
    action: "COUPON_DEACTIVATED",
    entityType: "Coupon",
    entityId: coupon.id,
    summary: `Cupom ${coupon.code} desativado.`,
    beforeData: {
      active: current.active,
    },
    afterData: {
      active: coupon.active,
    },
  });

  return coupon;
}
