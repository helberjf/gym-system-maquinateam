import type { z } from "zod";
import { PaymentMethod, Prisma, ProductStatus, SaleStatus } from "@prisma/client";
import type { ViewerContext } from "@/lib/academy/access";
import { endOfDay, slugify, startOfDay } from "@/lib/academy/constants";
import { logAuditEvent } from "@/lib/audit";
import {
  ensureVisibleProduct,
  ensureVisibleProductSale,
  getProductSaleVisibilityWhere,
  getProductVisibilityWhere,
} from "@/lib/commerce/access";
import { buildSaleNumber, isLowStockProduct } from "@/lib/commerce/constants";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/uploads/r2";
import {
  createProductSaleSchema,
  createProductSchema,
  productFiltersSchema,
  saleFiltersSchema,
  updateProductSchema,
} from "@/lib/validators";

type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
type SaleFiltersInput = z.infer<typeof saleFiltersSchema>;
type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type CreateProductSaleInput = z.infer<typeof createProductSaleSchema>;

type MutationContext = {
  viewer: ViewerContext;
  request?: Request;
};

type TransactionClient = Prisma.TransactionClient;

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
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

function resolveProductStatus(input: {
  active: boolean;
  trackInventory: boolean;
  stockQuantity: number;
}) {
  if (!input.active) {
    return ProductStatus.ARCHIVED;
  }

  if (input.trackInventory && input.stockQuantity <= 0) {
    return ProductStatus.OUT_OF_STOCK;
  }

  return ProductStatus.ACTIVE;
}

function normalizeProductImages(
  images: CreateProductInput["images"],
  fallbackAltText: string,
) {
  const normalized = images
    .map((image) => ({
      url: image.url.trim(),
      storageKey: normalizeOptionalString(image.storageKey),
      altText: normalizeOptionalString(image.altText) ?? fallbackAltText,
      isPrimary: image.isPrimary ?? false,
    }))
    .filter((image) => image.url.length > 0);

  const primaryIndex = normalized.findIndex((image) => image.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return normalized.map((image, index) => ({
    ...image,
    isPrimary: normalized.length > 0 ? index === resolvedPrimaryIndex : false,
    sortOrder: index,
  }));
}

async function ensureUniqueProductIdentifiers(
  tx: TransactionClient,
  input: {
    slug: string;
    sku: string;
    productId?: string;
  },
) {
  const existing = await tx.product.findFirst({
    where: {
      OR: [{ slug: input.slug }, { sku: input.sku }],
      ...(input.productId
        ? {
            id: {
              not: input.productId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      sku: true,
    },
  });

  if (!existing) {
    return;
  }

  if (existing.slug === input.slug) {
    throw new ConflictError("Ja existe um produto com este slug.");
  }

  if (existing.sku === input.sku) {
    throw new ConflictError("Ja existe um produto com este SKU.");
  }
}

async function ensureStudentExists(
  tx: TransactionClient,
  studentProfileId: string,
) {
  const student = await tx.studentProfile.findUnique({
    where: {
      id: studentProfileId,
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
  });

  if (!student) {
    throw new NotFoundError("Aluno nao encontrado.");
  }

  return student;
}

async function ensureSellableProduct(
  tx: TransactionClient,
  input: {
    productId: string;
    quantity: number;
  },
) {
  const product = await tx.product.findUnique({
    where: {
      id: input.productId,
    },
    select: {
      id: true,
      name: true,
      priceCents: true,
      status: true,
      stockQuantity: true,
      lowStockThreshold: true,
      trackInventory: true,
      category: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado.");
  }

  if (product.status === ProductStatus.ARCHIVED) {
    throw new ConflictError(`O produto ${product.name} esta inativo.`);
  }

  if (product.trackInventory && product.stockQuantity < input.quantity) {
    throw new ConflictError(`Estoque insuficiente para ${product.name}.`);
  }

  return product;
}

async function generateUniqueSaleNumber(
  tx: TransactionClient,
  referenceDate: Date,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const saleNumber = buildSaleNumber(referenceDate);
    const existing = await tx.productSale.findUnique({
      where: {
        saleNumber,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return saleNumber;
    }
  }

  throw new ConflictError("Nao foi possivel gerar um numero unico para a venda.");
}

async function updateProductInventoryAfterSale(
  tx: TransactionClient,
  item: {
    productId: string;
    quantity: number;
  },
) {
  const product = await tx.product.findUnique({
    where: {
      id: item.productId,
    },
    select: {
      id: true,
      stockQuantity: true,
      trackInventory: true,
      status: true,
    },
  });

  if (!product?.trackInventory) {
    return;
  }

  const nextStock = Math.max(0, product.stockQuantity - item.quantity);

  await tx.product.update({
    where: {
      id: item.productId,
    },
    data: {
      stockQuantity: {
        decrement: item.quantity,
      },
      status:
        nextStock <= 0
          ? ProductStatus.OUT_OF_STOCK
          : product.status === ProductStatus.ARCHIVED
            ? ProductStatus.ARCHIVED
            : ProductStatus.ACTIVE,
    },
  });
}

async function getProductCategories(viewer: ViewerContext) {
  const categories = await prisma.product.findMany({
    where: getProductVisibilityWhere(viewer),
    distinct: ["category"],
    orderBy: {
      category: "asc",
    },
    select: {
      category: true,
    },
  });

  return categories.map((entry) => entry.category);
}

async function getProductOptions(viewer: ViewerContext) {
  return {
    categories: await getProductCategories(viewer),
  };
}

export async function getSaleOptions(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "manageSales")) {
    return null;
  }

  const [students, products] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where: {
        user: {
          isActive: true,
        },
      },
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
    prisma.product.findMany({
      where: {
        status: {
          not: ProductStatus.ARCHIVED,
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        priceCents: true,
        stockQuantity: true,
        lowStockThreshold: true,
        trackInventory: true,
        status: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: {
            url: true,
          },
        },
      },
    }),
  ]);

  return {
    students,
    products: products.filter(
      (product) => !product.trackInventory || product.stockQuantity > 0,
    ),
  };
}

export async function getProductsIndexData(
  viewer: ViewerContext,
  filters: ProductFiltersInput,
) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      getProductVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                sku: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                category: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      filters.category
        ? {
            category: filters.category,
          }
        : {},
      filters.status && filters.status !== "LOW_STOCK"
        ? {
            status: filters.status,
          }
        : {},
    ],
  };

  const productOrderBy = [
    {
      status: "asc" as const,
    },
    {
      category: "asc" as const,
    },
    {
      name: "asc" as const,
    },
  ];

  const [summaryRows, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: productOrderBy,
      select: {
        id: true,
        status: true,
        priceCents: true,
        stockQuantity: true,
        lowStockThreshold: true,
        trackInventory: true,
      },
    }),
    getProductCategories(viewer),
  ]);

  const filteredProductRows =
    filters.status === "LOW_STOCK"
      ? summaryRows.filter((product) =>
          isLowStockProduct({
            trackInventory: product.trackInventory,
            stockQuantity: product.stockQuantity,
            lowStockThreshold: product.lowStockThreshold,
            status: product.status,
          }),
        )
      : summaryRows;

  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: filteredProductRows.length,
  });
  const pagedProductIds =
    filters.status === "LOW_STOCK"
      ? filteredProductRows
          .slice(pagination.skip, pagination.skip + pagination.limit)
          .map((product) => product.id)
      : null;
  const products = await prisma.product.findMany({
    where:
      filters.status === "LOW_STOCK"
        ? {
            id: {
              in: pagedProductIds ?? [],
            },
          }
        : where,
    orderBy: filters.status === "LOW_STOCK" ? undefined : productOrderBy,
    skip: filters.status === "LOW_STOCK" ? undefined : pagination.skip,
    take: filters.status === "LOW_STOCK" ? undefined : pagination.limit,
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      category: true,
      shortDescription: true,
      description: true,
      status: true,
      priceCents: true,
      stockQuantity: true,
      lowStockThreshold: true,
      trackInventory: true,
      storeVisible: true,
      featured: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: {
          id: true,
          url: true,
          altText: true,
          isPrimary: true,
        },
      },
      _count: {
        select: {
          saleItems: true,
        },
      },
    },
  });
  const orderedProducts =
    filters.status === "LOW_STOCK" && pagedProductIds
      ? pagedProductIds
          .map((productId) => products.find((product) => product.id === productId))
          .filter((product): product is (typeof products)[number] => Boolean(product))
      : products;

  const summary = filteredProductRows.reduce(
    (accumulator, product) => {
      accumulator.totalProducts += 1;
      accumulator.inventoryValueCents += product.priceCents * product.stockQuantity;

      if (product.status === ProductStatus.ACTIVE) {
        accumulator.activeProducts += 1;
      }

      if (product.status === ProductStatus.ARCHIVED) {
        accumulator.archivedProducts += 1;
      }

      if (product.status === ProductStatus.OUT_OF_STOCK) {
        accumulator.outOfStockProducts += 1;
      }

      if (
        isLowStockProduct({
          trackInventory: product.trackInventory,
          stockQuantity: product.stockQuantity,
          lowStockThreshold: product.lowStockThreshold,
          status: product.status,
        })
      ) {
        accumulator.lowStockProducts += 1;
      }

      return accumulator;
    },
    {
      totalProducts: 0,
      activeProducts: 0,
      archivedProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
      inventoryValueCents: 0,
    },
  );

  return {
    products: orderedProducts,
    pagination,
    summary,
    options: {
      categories,
    },
    canManage: hasPermission(viewer.role, "manageProducts"),
  };
}

export async function getProductDetailData(
  viewer: ViewerContext,
  productId: string,
) {
  await ensureVisibleProduct(viewer, productId);

  const product = await prisma.product.findFirst({
    where: {
      AND: [getProductVisibilityWhere(viewer), { id: productId }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      category: true,
      shortDescription: true,
      description: true,
      status: true,
      priceCents: true,
      stockQuantity: true,
      lowStockThreshold: true,
      trackInventory: true,
      storeVisible: true,
      featured: true,
      weightGrams: true,
      heightCm: true,
      widthCm: true,
      lengthCm: true,
      createdAt: true,
      updatedAt: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          url: true,
          storageKey: true,
          altText: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
      _count: {
        select: {
          saleItems: true,
        },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado.");
  }

  const recentSales = hasPermission(viewer.role, "viewSales")
    ? await prisma.productSaleItem.findMany({
        where: {
          productId,
          productSale: {
            is: getProductSaleVisibilityWhere(viewer),
          },
        },
        orderBy: [
          {
            productSale: {
              soldAt: "desc",
            },
          },
        ],
        take: 8,
        select: {
          id: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
          productSale: {
            select: {
              id: true,
              saleNumber: true,
              soldAt: true,
              status: true,
              customerName: true,
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
          },
        },
      })
    : [];

  return {
    product,
    recentSales,
    options: await getProductOptions(viewer),
    canManage: hasPermission(viewer.role, "manageProducts"),
  };
}

export async function createProduct(
  input: CreateProductInput,
  context: MutationContext,
) {
  const slug = input.slug ?? slugify(input.name);
  const status = resolveProductStatus({
    active: input.active ?? true,
    trackInventory: input.trackInventory ?? true,
    stockQuantity: input.stockQuantity ?? 0,
  });
  const images = normalizeProductImages(input.images, input.name);

  const product = await prisma.$transaction(async (tx) => {
    await ensureUniqueProductIdentifiers(tx, {
      slug,
      sku: input.sku,
    });

    return tx.product.create({
      data: {
        name: input.name,
        slug,
        sku: input.sku,
        category: input.category,
        shortDescription: normalizeOptionalString(input.shortDescription),
        description: normalizeOptionalString(input.description),
        status,
        priceCents: input.priceCents,
        stockQuantity: input.stockQuantity,
        lowStockThreshold: input.lowStockThreshold,
        trackInventory: input.trackInventory,
        storeVisible: input.storeVisible,
        featured: input.featured,
        weightGrams: input.weightGrams ?? null,
        heightCm: input.heightCm ?? null,
        widthCm: input.widthCm ?? null,
        lengthCm: input.lengthCm ?? null,
        images: images.length
          ? {
              create: images,
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    summary: `Produto ${product.name} criado.`,
    afterData: {
      slug: product.slug,
      category: input.category,
      status: product.status,
      priceCents: input.priceCents,
      stockQuantity: input.stockQuantity,
      shortDescription: normalizeOptionalString(input.shortDescription),
      storeVisible: input.storeVisible,
      featured: input.featured,
      weightGrams: input.weightGrams ?? null,
      dimensions: {
        heightCm: input.heightCm ?? null,
        widthCm: input.widthCm ?? null,
        lengthCm: input.lengthCm ?? null,
      },
      images: images.map((image) => ({
        url: image.url,
        storageKey: image.storageKey,
      })),
    },
  });

  return product;
}

export async function updateProduct(
  input: UpdateProductInput,
  context: MutationContext,
) {
  const existing = await prisma.product.findUnique({
    where: {
      id: input.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      category: true,
      shortDescription: true,
      status: true,
      priceCents: true,
      stockQuantity: true,
      lowStockThreshold: true,
      trackInventory: true,
      storeVisible: true,
      featured: true,
      weightGrams: true,
      heightCm: true,
      widthCm: true,
      lengthCm: true,
      images: {
        select: {
          id: true,
          url: true,
          storageKey: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Produto nao encontrado.");
  }

  const slug = input.slug ?? slugify(input.name);
  const status = resolveProductStatus({
    active: input.active ?? true,
    trackInventory: input.trackInventory ?? true,
    stockQuantity: input.stockQuantity ?? 0,
  });
  const nextImages = normalizeProductImages(input.images, input.name);
  const nextStorageKeys = new Set(
    nextImages
      .map((image) => image.storageKey)
      .filter((value): value is string => Boolean(value)),
  );
  const removedStorageKeys = existing.images
    .map((image) => image.storageKey)
    .filter(
      (storageKey): storageKey is string =>
        typeof storageKey === "string" && !nextStorageKeys.has(storageKey),
    );

  const product = await prisma.$transaction(async (tx) => {
    await ensureUniqueProductIdentifiers(tx, {
      slug,
      sku: input.sku,
      productId: input.id,
    });

    return tx.product.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        slug,
        sku: input.sku,
        category: input.category,
        shortDescription: normalizeOptionalString(input.shortDescription),
        description: normalizeOptionalString(input.description),
        status,
        priceCents: input.priceCents,
        stockQuantity: input.stockQuantity,
        lowStockThreshold: input.lowStockThreshold,
        trackInventory: input.trackInventory,
        storeVisible: input.storeVisible,
        featured: input.featured,
        weightGrams: input.weightGrams ?? null,
        heightCm: input.heightCm ?? null,
        widthCm: input.widthCm ?? null,
        lengthCm: input.lengthCm ?? null,
        images: {
          deleteMany: {},
          ...(nextImages.length
            ? {
                create: nextImages,
              }
            : {}),
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });
  });

  if (removedStorageKeys.length > 0) {
    const deletionResults = await Promise.allSettled(
      removedStorageKeys.map((storageKey) => deleteFromR2(storageKey)),
    );

    deletionResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("r2 delete error:", result.reason);
      }
    });
  }

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: product.id,
    summary: `Produto ${product.name} atualizado.`,
    beforeData: {
      slug: existing.slug,
      sku: existing.sku,
      category: existing.category,
      status: existing.status,
      priceCents: existing.priceCents,
      stockQuantity: existing.stockQuantity,
      lowStockThreshold: existing.lowStockThreshold,
      trackInventory: existing.trackInventory,
      images: existing.images.map((image) => ({
        url: image.url,
        storageKey: image.storageKey,
      })),
    },
    afterData: {
      slug: product.slug,
      sku: input.sku,
      category: input.category,
      status: product.status,
      priceCents: input.priceCents,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      trackInventory: input.trackInventory,
      shortDescription: normalizeOptionalString(input.shortDescription),
      storeVisible: input.storeVisible,
      featured: input.featured,
      weightGrams: input.weightGrams ?? null,
      dimensions: {
        heightCm: input.heightCm ?? null,
        widthCm: input.widthCm ?? null,
        lengthCm: input.lengthCm ?? null,
      },
      images: nextImages.map((image) => ({
        url: image.url,
        storageKey: image.storageKey,
      })),
    },
  });

  return product;
}

export async function archiveProduct(
  productId: string,
  context: MutationContext,
) {
  const existing = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Produto nao encontrado.");
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      status: ProductStatus.ARCHIVED,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PRODUCT_ARCHIVED",
    entityType: "Product",
    entityId: product.id,
    summary: `Produto ${product.name} inativado.`,
    beforeData: {
      status: existing.status,
    },
    afterData: {
      status: product.status,
    },
  });

  return product;
}

export async function getProductSalesIndexData(
  viewer: ViewerContext,
  filters: SaleFiltersInput,
) {
  const where: Prisma.ProductSaleWhereInput = {
    AND: [
      getProductSaleVisibilityWhere(viewer),
      filters.search
        ? {
            OR: [
              {
                saleNumber: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                customerName: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                studentProfile: {
                  user: {
                    name: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                items: {
                  some: {
                    product: {
                      name: {
                        contains: filters.search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            ],
          }
        : {},
      filters.studentId
        ? {
            studentProfileId: filters.studentId,
          }
        : {},
      filters.status
        ? {
            status: filters.status,
          }
        : {},
      filters.dateFrom || filters.dateTo
        ? {
            soldAt: {
              ...(filters.dateFrom ? { gte: parseDateOnly(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: endOfDay(parseDateOnly(filters.dateTo)) } : {}),
            },
          }
        : {},
    ],
  };

  const [totalSales, summaryRows, lowStockProductsCount, options] = await Promise.all([
    prisma.productSale.count({ where }),
    prisma.productSale.findMany({
      where,
      select: {
        status: true,
        totalCents: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        status: {
          not: ProductStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
        status: true,
        stockQuantity: true,
        lowStockThreshold: true,
        trackInventory: true,
      },
    }),
    getSaleOptions(viewer),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalSales,
  });
  const sales = await prisma.productSale.findMany({
    where,
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      saleNumber: true,
      status: true,
      paymentMethod: true,
      subtotalCents: true,
      discountCents: true,
      totalCents: true,
      customerName: true,
      soldAt: true,
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
        orderBy: {
          product: {
            name: "asc",
          },
        },
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

  const summary = summaryRows.reduce(
    (accumulator, sale) => {
      accumulator.totalSales += 1;
      accumulator.totalItems += sale.items.reduce(
        (total, item) => total + item.quantity,
        0,
      );

      if (sale.status === SaleStatus.PAID) {
        accumulator.paidSales += 1;
        accumulator.revenueCents += sale.totalCents;
      }

      if (sale.status === SaleStatus.PENDING) {
        accumulator.pendingSales += 1;
      }

      return accumulator;
    },
    {
      totalSales: 0,
      paidSales: 0,
      pendingSales: 0,
      totalItems: 0,
      revenueCents: 0,
    },
  );

  return {
    sales,
    pagination,
    summary: {
      ...summary,
      lowStockProducts: lowStockProductsCount.filter((product) =>
        isLowStockProduct(product),
      ).length,
    },
    options,
    canManage: hasPermission(viewer.role, "manageSales"),
  };
}

export async function getProductSaleDetailData(
  viewer: ViewerContext,
  saleId: string,
) {
  await ensureVisibleProductSale(viewer, saleId);

  const sale = await prisma.productSale.findFirst({
    where: {
      AND: [getProductSaleVisibilityWhere(viewer), { id: saleId }],
    },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      paymentMethod: true,
      subtotalCents: true,
      discountCents: true,
      totalCents: true,
      customerName: true,
      customerDocument: true,
      notes: true,
      soldAt: true,
      soldByUser: {
        select: {
          name: true,
          email: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          registrationNumber: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      items: {
        orderBy: {
          product: {
            name: "asc",
          },
        },
        select: {
          id: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
              images: {
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                take: 1,
                select: {
                  url: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!sale) {
    throw new NotFoundError("Venda nao encontrada.");
  }

  return {
    sale,
    canManage: hasPermission(viewer.role, "manageSales"),
    options: await getSaleOptions(viewer),
  };
}

export async function createProductSale(
  input: CreateProductSaleInput,
  context: MutationContext,
) {
  const soldAt = parseDateOnly(input.soldAt) ?? new Date();

  const sale = await prisma.$transaction(async (tx) => {
    const student = input.studentProfileId
      ? await ensureStudentExists(tx, input.studentProfileId)
      : null;
    const saleNumber = await generateUniqueSaleNumber(tx, soldAt);
    const preparedItems: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
      name: string;
    }> = [];

    let subtotalCents = 0;

    for (const item of input.items) {
      const product = await ensureSellableProduct(tx, {
        productId: item.productId,
        quantity: item.quantity,
      });
      const lineTotalCents = product.priceCents * item.quantity;

      preparedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        lineTotalCents,
        name: product.name,
      });
      subtotalCents += lineTotalCents;
    }

    if (input.discountCents > subtotalCents) {
      throw new ConflictError("O desconto nao pode ser maior que o subtotal da venda.");
    }

    const created = await tx.productSale.create({
      data: {
        saleNumber,
        studentProfileId: input.studentProfileId ?? null,
        customerName: normalizeOptionalString(input.customerName) ?? student?.user.name ?? null,
        customerDocument: normalizeOptionalString(input.customerDocument),
        soldByUserId: context.viewer.userId,
        status: input.status,
        paymentMethod: input.paymentMethod as PaymentMethod,
        subtotalCents,
        discountCents: input.discountCents,
        totalCents: subtotalCents - input.discountCents,
        notes: normalizeOptionalString(input.notes),
        soldAt,
        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
          })),
        },
      },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        totalCents: true,
      },
    });

    if (input.status === SaleStatus.PAID) {
      for (const item of preparedItems) {
        await updateProductInventoryAfterSale(tx, item);
      }
    }

    return created;
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.viewer.userId,
    action: "PRODUCT_SALE_CREATED",
    entityType: "ProductSale",
    entityId: sale.id,
    summary: `Venda ${sale.saleNumber} registrada.`,
    afterData: {
      saleNumber: sale.saleNumber,
      status: sale.status,
      totalCents: sale.totalCents,
      studentProfileId: input.studentProfileId ?? null,
      paymentMethod: input.paymentMethod,
      itemCount: input.items.length,
      discountCents: input.discountCents,
    },
  });

  return sale;
}
