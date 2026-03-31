import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { ViewerContext } from "@/lib/academy/access";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function noAccessId() {
  return "__no_access__";
}

export function getProductVisibilityWhere(
  viewer: ViewerContext,
): Prisma.ProductWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
    case UserRole.PROFESSOR:
      return {};
    default:
      return {
        id: noAccessId(),
      };
  }
}

export function getProductSaleVisibilityWhere(
  viewer: ViewerContext,
): Prisma.ProductSaleWhereInput {
  switch (viewer.role) {
    case UserRole.ADMIN:
    case UserRole.RECEPCAO:
      return {};
    case UserRole.ALUNO:
      return viewer.studentProfileId
        ? {
            studentProfileId: viewer.studentProfileId,
          }
        : {
            id: noAccessId(),
          };
    default:
      return {
        id: noAccessId(),
      };
  }
}

export async function ensureVisibleProduct(
  viewer: ViewerContext,
  productId: string,
) {
  const product = await prisma.product.findFirst({
    where: {
      AND: [getProductVisibilityWhere(viewer), { id: productId }],
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado ou indisponivel.");
  }

  return product;
}

export async function ensureVisibleProductSale(
  viewer: ViewerContext,
  saleId: string,
) {
  const sale = await prisma.productSale.findFirst({
    where: {
      AND: [getProductSaleVisibilityWhere(viewer), { id: saleId }],
    },
    select: {
      id: true,
    },
  });

  if (!sale) {
    throw new NotFoundError("Venda nao encontrada ou indisponivel.");
  }

  return sale;
}
