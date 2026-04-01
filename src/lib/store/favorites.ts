import { auth } from "@/auth";
import { ProductStatus } from "@prisma/client";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  publicProductCardSelect,
  type StoreCatalogProductCard,
} from "@/lib/store/catalog";

async function requireWishlistUserId() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new UnauthorizedError("Entre na sua conta para salvar favoritos.");
  }

  return userId;
}

async function ensureWishlist(userId: string) {
  return prisma.wishlist.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
    },
  });
}

async function ensureWishlistProduct(productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      storeVisible: true,
      status: {
        not: ProductStatus.ARCHIVED,
      },
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado para favoritos.");
  }

  return product;
}

export async function getStoreFavoriteProductIds() {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      items: {
        select: {
          productId: true,
        },
      },
    },
  });

  return wishlist?.items.map((item) => item.productId) ?? [];
}

export async function getStoreWishlistSummary() {
  const session = await auth().catch(() => null);

  if (!session?.user?.id) {
    return {
      authenticated: false,
      count: 0,
    };
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  return {
    authenticated: true,
    count: wishlist?._count.items ?? 0,
  };
}

export async function getStoreWishlistSnapshot() {
  const userId = await requireWishlistUserId();
  const wishlist = await prisma.wishlist.findUnique({
    where: {
      userId,
    },
    select: {
      items: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          product: {
            select: publicProductCardSelect,
          },
        },
      },
    },
  });

  const products = wishlist?.items.map((item) => item.product) as StoreCatalogProductCard[] | undefined;

  return {
    authenticated: true,
    count: products?.length ?? 0,
    productIds: products?.map((product) => product.id) ?? [],
    products: products ?? [],
  };
}

export async function addStoreWishlistItem(productId: string) {
  const userId = await requireWishlistUserId();
  await ensureWishlistProduct(productId);
  const wishlist = await ensureWishlist(userId);

  await prisma.wishlistItem.upsert({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
    update: {},
    create: {
      wishlistId: wishlist.id,
      productId,
    },
  });

  return getStoreWishlistSummary();
}

export async function removeStoreWishlistItem(productId: string) {
  const userId = await requireWishlistUserId();
  const wishlist = await prisma.wishlist.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!wishlist) {
    return getStoreWishlistSummary();
  }

  await prisma.wishlistItem.deleteMany({
    where: {
      wishlistId: wishlist.id,
      productId,
    },
  });

  return getStoreWishlistSummary();
}
