import { cookies } from "next/headers";
import { ProductStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { isLowStockProduct } from "@/lib/commerce/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  STORE_CART_COOKIE,
  STORE_CART_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/store/constants";

type CartClient = Prisma.TransactionClient | typeof prisma;

function buildCartExpiryDate() {
  return new Date(Date.now() + STORE_CART_COOKIE_MAX_AGE_SECONDS * 1000);
}

async function getCartCookieStore() {
  return cookies();
}

function canPurchaseProduct(input: {
  status: ProductStatus;
  storeVisible: boolean;
  trackInventory: boolean;
  stockQuantity: number;
}) {
  if (!input.storeVisible || input.status === ProductStatus.ARCHIVED) {
    return false;
  }

  if (input.trackInventory && input.stockQuantity <= 0) {
    return false;
  }

  return true;
}

async function ensureStoreProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      status: true,
      storeVisible: true,
      trackInventory: true,
      stockQuantity: true,
      lowStockThreshold: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: {
          url: true,
          altText: true,
        },
      },
    },
  });

  if (!product || !canPurchaseProduct(product)) {
    throw new ConflictError("Produto indisponivel para compra no momento.");
  }

  return product;
}

async function getGuestCartToken(options?: { createIfMissing?: boolean }) {
  const cookieStore = await getCartCookieStore();
  const existingToken = cookieStore.get(STORE_CART_COOKIE)?.value;

  if (existingToken || !options?.createIfMissing) {
    return existingToken ?? null;
  }

  const sessionToken = crypto.randomUUID();
  cookieStore.set(STORE_CART_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STORE_CART_COOKIE_MAX_AGE_SECONDS,
  });

  return sessionToken;
}

async function mergeGuestCartIntoUserCart(db: CartClient, input: {
  userId: string;
  sessionToken: string;
}) {
  const guestCart = await db.cart.findUnique({
    where: {
      sessionToken: input.sessionToken,
    },
    include: {
      items: true,
    },
  });

  if (!guestCart || guestCart.userId) {
    return;
  }

  const userCart = await db.cart.upsert({
    where: {
      userId: input.userId,
    },
    update: {
      expiresAt: null,
    },
    create: {
      userId: input.userId,
    },
  });

  for (const item of guestCart.items) {
    const product = await db.product.findUnique({
      where: {
        id: item.productId,
      },
      select: {
        trackInventory: true,
        stockQuantity: true,
      },
    });

    const existingItem = await db.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: userCart.id,
          productId: item.productId,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    const requestedQuantity = (existingItem?.quantity ?? 0) + item.quantity;
    const nextQuantity =
      product?.trackInventory && Number.isFinite(product.stockQuantity)
        ? Math.max(1, Math.min(requestedQuantity, product.stockQuantity))
        : requestedQuantity;

    await db.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: userCart.id,
          productId: item.productId,
        },
      },
      update: {
        quantity: nextQuantity,
      },
      create: {
        cartId: userCart.id,
        productId: item.productId,
        quantity: nextQuantity,
      },
    });
  }

  await db.cart.delete({
    where: {
      id: guestCart.id,
    },
  });
}

async function getOrCreateActiveCart(options?: { createIfMissing?: boolean }) {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  if (userId) {
    const sessionToken = await getGuestCartToken();

    if (sessionToken) {
      await prisma.$transaction(async (tx) => {
        await mergeGuestCartIntoUserCart(tx, {
          userId,
          sessionToken,
        });
      });
    }

    if (!options?.createIfMissing) {
      return prisma.cart.findUnique({
        where: {
          userId,
        },
      });
    }

    return prisma.cart.upsert({
      where: {
        userId,
      },
      update: {
        expiresAt: null,
      },
      create: {
        userId,
      },
    });
  }

  const sessionToken = await getGuestCartToken({
    createIfMissing: options?.createIfMissing,
  });

  if (!sessionToken) {
    return null;
  }

  if (!options?.createIfMissing) {
    return prisma.cart.findUnique({
      where: {
        sessionToken,
      },
    });
  }

  return prisma.cart.upsert({
    where: {
      sessionToken,
    },
    update: {
      expiresAt: buildCartExpiryDate(),
    },
    create: {
      sessionToken,
      expiresAt: buildCartExpiryDate(),
    },
  });
}

export async function getCartSnapshot() {
  const session = await auth().catch(() => null);
  const cart = await getOrCreateActiveCart();

  if (!cart) {
    return {
      cartId: null,
      authenticated: Boolean(session?.user?.id),
      items: [] as Array<never>,
      summary: {
        itemCount: 0,
        subtotalCents: 0,
      },
    };
  }

  const items = await prisma.cartItem.findMany({
    where: {
      cartId: cart.id,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          shortDescription: true,
          priceCents: true,
          status: true,
          storeVisible: true,
          stockQuantity: true,
          lowStockThreshold: true,
          trackInventory: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: {
              url: true,
              altText: true,
            },
          },
        },
      },
    },
  });

  const normalizedItems = items.map((item) => {
    const available = canPurchaseProduct(item.product);
    const maxQuantity = item.product.trackInventory ? item.product.stockQuantity : null;
    const clampedQuantity =
      maxQuantity !== null ? Math.min(item.quantity, Math.max(maxQuantity, 0)) : item.quantity;

    return {
      id: item.id,
      quantity: item.quantity,
      clampedQuantity,
      available,
      lineTotalCents: item.quantity * item.product.priceCents,
      product: {
        ...item.product,
        image: item.product.images[0] ?? null,
        isLowStock: isLowStockProduct({
          trackInventory: item.product.trackInventory,
          stockQuantity: item.product.stockQuantity,
          lowStockThreshold: item.product.lowStockThreshold,
          status: item.product.status,
        }),
      },
    };
  });

  return {
    cartId: cart.id,
    authenticated: Boolean(session?.user?.id),
    items: normalizedItems,
    summary: {
      itemCount: normalizedItems.reduce((total, item) => total + item.quantity, 0),
      subtotalCents: normalizedItems.reduce((total, item) => total + item.lineTotalCents, 0),
    },
  };
}

export async function addCartItem(input: {
  productId: string;
  quantity: number;
}) {
  const product = await ensureStoreProduct(input.productId);
  const cart = await getOrCreateActiveCart({ createIfMissing: true });

  if (!cart) {
    throw new NotFoundError("Nao foi possivel iniciar o carrinho.");
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: input.productId,
      },
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  const nextQuantity = (existingItem?.quantity ?? 0) + input.quantity;

  if (product.trackInventory && nextQuantity > product.stockQuantity) {
    throw new ConflictError(`Estoque insuficiente para ${product.name}.`);
  }

  await prisma.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: input.productId,
      },
    },
    update: {
      quantity: nextQuantity,
    },
    create: {
      cartId: cart.id,
      productId: input.productId,
      quantity: input.quantity,
    },
  });

  return getCartSnapshot();
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  const cart = await getOrCreateActiveCart();

  if (!cart) {
    throw new NotFoundError("Carrinho nao encontrado.");
  }

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cart.id,
    },
    select: {
      id: true,
      productId: true,
    },
  });

  if (!item) {
    throw new NotFoundError("Item do carrinho nao encontrado.");
  }

  const product = await ensureStoreProduct(item.productId);

  if (product.trackInventory && quantity > product.stockQuantity) {
    throw new ConflictError(`Estoque insuficiente para ${product.name}.`);
  }

  await prisma.cartItem.update({
    where: {
      id: item.id,
    },
    data: {
      quantity,
    },
  });

  return getCartSnapshot();
}

export async function removeCartItem(itemId: string) {
  const cart = await getOrCreateActiveCart();

  if (!cart) {
    throw new NotFoundError("Carrinho nao encontrado.");
  }

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cart.id,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new NotFoundError("Item do carrinho nao encontrado.");
  }

  await prisma.cartItem.delete({
    where: {
      id: item.id,
    },
  });

  return getCartSnapshot();
}

export async function clearActiveCart() {
  const cart = await getOrCreateActiveCart();

  if (!cart) {
    return;
  }

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
    },
  });
}
