import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pixStatusRoute from "@/app/api/payments/pix/status/route";
import * as storeCartRoute from "@/app/api/store/cart/route";
import * as storeCartItemsRoute from "@/app/api/store/cart/items/route";
import * as storeCartItemIdRoute from "@/app/api/store/cart/items/[itemId]/route";
import * as storeCatalogRoute from "@/app/api/store/catalog/route";
import * as storeCheckoutRoute from "@/app/api/store/checkout/route";
import * as storeCouponRoute from "@/app/api/store/coupon/route";
import * as storeCouponsRoute from "@/app/api/store/coupons/route";
import * as storeCouponsIdRoute from "@/app/api/store/coupons/[id]/route";
import * as storeOrderRefundRoute from "@/app/api/store/orders/[id]/refund/route";
import * as storeOrderStatusRoute from "@/app/api/store/orders/[id]/status/route";
import * as storeShippingQuoteRoute from "@/app/api/store/shipping/quote/route";
import * as storeWishlistRoute from "@/app/api/store/wishlist/route";
import {
  expectRateLimitHeaders,
  jsonRequest,
  paramsContext,
  readJson,
} from "./helpers/api-route";

const mocks = vi.hoisted(() => {
  const session = {
    user: {
      id: "user-1",
      role: "ADMIN",
    },
  };
  const rateLimitHeaders = new Headers({ "X-RateLimit-Limit": "99" });

  return {
    session,
    rateLimitHeaders,
    after: vi.fn((callback: () => unknown) => callback()),
    getOptionalSession: vi.fn(async () => session),
    requireApiPermission: vi.fn(async () => session),
    enforceRateLimit: vi.fn(async () => ({
      headers: rateLimitHeaders,
    })),
    parseJsonBody: vi.fn(async (request: Request) => request.json()),
    parseSearchParams: vi.fn(
      (input: URLSearchParams | Record<string, unknown>) =>
        input instanceof URLSearchParams
          ? Object.fromEntries(input.entries())
          : input,
    ),
    getPixCheckoutStatus: vi.fn(async () => ({
      checkoutPaymentId: "checkout-payment-1",
      status: "PENDING",
      orderId: "order-1",
      orderNumber: "PED-0001",
    })),
    getCartSnapshot: vi.fn(async () => ({
      cartId: "cart-1",
      items: [
        {
          id: "item-1",
          quantity: 2,
          product: {
            id: "product-1",
            category: "luvas",
            priceCents: 1500,
          },
        },
      ],
      summary: {
        itemCount: 2,
        subtotalCents: 3000,
      },
    })),
    addCartItem: vi.fn(async () => ({
      cartId: "cart-1",
      items: [],
      summary: {
        itemCount: 3,
      },
    })),
    updateCartItemQuantity: vi.fn(async () => ({
      cartId: "cart-1",
      items: [],
      summary: {
        itemCount: 4,
      },
    })),
    removeCartItem: vi.fn(async () => ({
      cartId: "cart-1",
      items: [],
      summary: {
        itemCount: 1,
      },
    })),
    getStoreCatalogPageData: vi.fn(async () => ({
      products: [{ id: "product-1" }],
      source: "database",
      pagination: {
        page: 1,
        limit: 24,
        total: 1,
        totalPages: 1,
      },
    })),
    getStoreFavoriteProductIds: vi.fn(async () => ["product-1"]),
    getStoreWishlistSnapshot: vi.fn(async () => ({
      items: [{ productId: "product-1" }],
      summary: { count: 1 },
    })),
    addStoreWishlistItem: vi.fn(async () => ({ count: 2 })),
    removeStoreWishlistItem: vi.fn(async () => ({ count: 1 })),
    validateCouponForItems: vi.fn(async () => ({
      ok: true,
      coupon: {
        id: "coupon-1",
        code: "OFF10",
        description: "10% OFF",
      },
      discountCents: 300,
      eligibleSubtotalCents: 3000,
    })),
    createCoupon: vi.fn(async () => ({ id: "coupon-1" })),
    updateCoupon: vi.fn(async () => ({ id: "coupon-1" })),
    deactivateCoupon: vi.fn(async () => undefined),
    createStoreCheckoutSession: vi.fn(async () => ({
      orderId: "order-1",
      orderNumber: "PED-0001",
      totalCents: 3900,
      subtotalCents: 3000,
      discountCents: 300,
      shippingCents: 1200,
      redirectUrl: "https://example.com/checkout/redirect",
      customerEmail: "cliente@example.com",
      customerName: "Cliente",
      deliveryLabel: "PAC",
      paymentMethod: "PIX",
      emailItems: [],
    })),
    refundStoreOrder: vi.fn(async () => ({
      orderId: "order-1",
      orderNumber: "PED-0001",
    })),
    updateOrderStatus: vi.fn(async () => ({
      id: "order-1",
      status: "SHIPPED",
      orderNumber: "PED-0001",
      customerEmail: "cliente@example.com",
      customerName: "Cliente",
      trackingCode: "BR123",
      deliveryLabel: "PAC",
    })),
    getShippingQuoteForActiveCart: vi.fn(async () => [
      {
        service: "PAC",
        priceCents: 1200,
      },
    ]),
    getAppUrl: vi.fn(() => "https://example.com"),
    sendOrderConfirmationEmail: vi.fn(async () => undefined),
    sendOrderShippedEmail: vi.fn(async () => undefined),
    sendOrderDeliveredEmail: vi.fn(async () => undefined),
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");

  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("@/lib/auth/session", () => ({
  getOptionalSession: mocks.getOptionalSession,
}));

vi.mock("@/lib/permissions", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/rate-limit", () => ({
  adminLimiter: { key: "admin" },
  attachRateLimitHeaders: (response: Response, headers?: HeadersInit) => {
    if (!headers) {
      return response;
    }

    const nextHeaders = new Headers(headers);
    nextHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  },
  enforceRateLimit: mocks.enforceRateLimit,
  mutationLimiter: { key: "mutation" },
  pixStatusLimiter: { key: "pix-status" },
  publicReadLimiter: { key: "public-read" },
}));

vi.mock("@/lib/validators", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validators")>(
    "@/lib/validators",
  );

  return {
    ...actual,
    parseJsonBody: mocks.parseJsonBody,
    parseSearchParams: mocks.parseSearchParams,
  };
});

vi.mock("@/lib/payments/pix", () => ({
  getPixCheckoutStatus: mocks.getPixCheckoutStatus,
}));

vi.mock("@/lib/store/cart", () => ({
  getCartSnapshot: mocks.getCartSnapshot,
  addCartItem: mocks.addCartItem,
  updateCartItemQuantity: mocks.updateCartItemQuantity,
  removeCartItem: mocks.removeCartItem,
}));

vi.mock("@/lib/store/catalog", () => ({
  STORE_CATALOG_PAGE_SIZE: 24,
  getStoreCatalogPageData: mocks.getStoreCatalogPageData,
}));

vi.mock("@/lib/store/favorites", () => ({
  getStoreFavoriteProductIds: mocks.getStoreFavoriteProductIds,
  getStoreWishlistSnapshot: mocks.getStoreWishlistSnapshot,
  addStoreWishlistItem: mocks.addStoreWishlistItem,
  removeStoreWishlistItem: mocks.removeStoreWishlistItem,
}));

vi.mock("@/lib/store/coupons", () => ({
  validateCouponForItems: mocks.validateCouponForItems,
  createCoupon: mocks.createCoupon,
  updateCoupon: mocks.updateCoupon,
  deactivateCoupon: mocks.deactivateCoupon,
}));

vi.mock("@/lib/store/orders", () => ({
  createStoreCheckoutSession: mocks.createStoreCheckoutSession,
  refundStoreOrder: mocks.refundStoreOrder,
  updateOrderStatus: mocks.updateOrderStatus,
  getShippingQuoteForActiveCart: mocks.getShippingQuoteForActiveCart,
}));

vi.mock("@/lib/app-url", () => ({
  getAppUrl: mocks.getAppUrl,
}));

vi.mock("@/lib/mail", () => ({
  sendOrderConfirmationEmail: mocks.sendOrderConfirmationEmail,
  sendOrderShippedEmail: mocks.sendOrderShippedEmail,
  sendOrderDeliveredEmail: mocks.sendOrderDeliveredEmail,
  safeSendEmail: async <TArgs>(
    _label: string,
    sender: (args: TArgs) => Promise<unknown>,
    args: TArgs,
  ) => {
    try {
      await sender(args);
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
}));

describe("Store API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns PIX checkout status", async () => {
    const response = await pixStatusRoute.GET(
      new Request("https://example.com/api/payments/pix/status?payment=checkout-payment-1"),
    );
    const body = await readJson<{
      ok: boolean;
      checkoutPaymentId: string;
      orderId: string;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.checkoutPaymentId).toBe("checkout-payment-1");
    expect(body.orderId).toBe("order-1");
  });

  it("returns the current cart snapshot", async () => {
    const response = await storeCartRoute.GET(
      new Request("https://example.com/api/store/cart"),
    );
    const body = await readJson<{
      ok: boolean;
      cart: { cartId: string };
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.cart.cartId).toBe("cart-1");
  });

  it("adds items to the cart", async () => {
    const response = await storeCartItemsRoute.POST(
      jsonRequest("https://example.com/api/store/cart/items", {
        productId: "product-1",
        quantity: 1,
      }),
    );
    const body = await readJson<{ ok: boolean; cart: { cartId: string } }>(
      response,
    );

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.cart.cartId).toBe("cart-1");
  });

  it("updates cart item quantities", async () => {
    const response = await storeCartItemIdRoute.PATCH(
      jsonRequest("https://example.com/api/store/cart/items/item-1", {
        quantity: 3,
      }),
      paramsContext({ itemId: "item-1" }),
    );
    const body = await readJson<{ ok: boolean; cart: { cartId: string } }>(
      response,
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.cart.cartId).toBe("cart-1");
  });

  it("removes items from the cart", async () => {
    const response = await storeCartItemIdRoute.DELETE(
      new Request("https://example.com/api/store/cart/items/item-1", {
        method: "DELETE",
      }),
      paramsContext({ itemId: "item-1" }),
    );
    const body = await readJson<{ ok: boolean; cart: { cartId: string } }>(
      response,
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.cart.cartId).toBe("cart-1");
  });

  it("returns the public store catalog", async () => {
    const response = await storeCatalogRoute.GET(
      new Request("https://example.com/api/store/catalog?page=1"),
    );
    const body = await readJson<{
      ok: boolean;
      products: Array<{ id: string }>;
      favoriteIds: string[];
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.products[0]?.id).toBe("product-1");
    expect(body.favoriteIds).toEqual(["product-1"]);
  });

  it("starts store checkout and sends confirmation email when possible", async () => {
    const response = await storeCheckoutRoute.POST(
      jsonRequest("https://example.com/api/store/checkout", {
        deliveryMethod: "PICKUP",
        paymentMethod: "PIX",
      }),
    );
    const body = await readJson<{
      ok: boolean;
      orderId: string;
      redirectUrl: string;
    }>(response);

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.orderId).toBe("order-1");
    expect(body.redirectUrl).toContain("/checkout/redirect");
    expect(mocks.after).toHaveBeenCalled();
    expect(mocks.sendOrderConfirmationEmail).toHaveBeenCalled();
  });

  it("validates store coupons against the active cart", async () => {
    const response = await storeCouponRoute.POST(
      jsonRequest("https://example.com/api/store/coupon", {
        code: "OFF10",
      }),
    );
    const body = await readJson<{
      ok: boolean;
      valid: boolean;
      coupon: { id: string };
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.coupon.id).toBe("coupon-1");
  });

  it("creates admin store coupons", async () => {
    const response = await storeCouponsRoute.POST(
      jsonRequest("https://example.com/api/store/coupons", {
        code: "OFF10",
      }),
    );
    const body = await readJson<{ ok: boolean; couponId: string }>(response);

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.couponId).toBe("coupon-1");
  });

  it("updates admin store coupons", async () => {
    const response = await storeCouponsIdRoute.PATCH(
      jsonRequest("https://example.com/api/store/coupons/coupon-1", {
        description: "Cupom atualizado",
      }),
      paramsContext({ id: "coupon-1" }),
    );
    const body = await readJson<{ ok: boolean; couponId: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.couponId).toBe("coupon-1");
  });

  it("deactivates admin store coupons", async () => {
    const response = await storeCouponsIdRoute.DELETE(
      new Request("https://example.com/api/store/coupons/coupon-1", {
        method: "DELETE",
      }),
      paramsContext({ id: "coupon-1" }),
    );
    const body = await readJson<{ ok: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("refunds store orders", async () => {
    const response = await storeOrderRefundRoute.POST(
      new Request("https://example.com/api/store/orders/order-1/refund", {
        method: "POST",
      }),
      paramsContext({ id: "order-1" }),
    );
    const body = await readJson<{ ok: boolean; orderId: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.orderId).toBe("order-1");
  });

  it("updates store order status and sends shipping email", async () => {
    const response = await storeOrderStatusRoute.PATCH(
      jsonRequest("https://example.com/api/store/orders/order-1/status", {
        status: "SHIPPED",
      }),
      paramsContext({ id: "order-1" }),
    );
    const body = await readJson<{ ok: boolean; orderId: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.orderId).toBe("order-1");
    expect(mocks.after).toHaveBeenCalled();
    expect(mocks.sendOrderShippedEmail).toHaveBeenCalled();
  });

  it("sends delivery email when the order reaches delivered status", async () => {
    mocks.updateOrderStatus.mockResolvedValueOnce({
      id: "order-1",
      status: "DELIVERED",
      orderNumber: "PED-0001",
      customerEmail: "cliente@example.com",
      customerName: "Cliente",
      trackingCode: "BR123",
      deliveryLabel: "PAC",
    });

    const response = await storeOrderStatusRoute.PATCH(
      jsonRequest("https://example.com/api/store/orders/order-1/status", {
        status: "DELIVERED",
      }),
      paramsContext({ id: "order-1" }),
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(mocks.sendOrderDeliveredEmail).toHaveBeenCalled();
  });

  it("returns shipping quotes for the active cart", async () => {
    const response = await storeShippingQuoteRoute.POST(
      jsonRequest("https://example.com/api/store/shipping/quote", {
        address: {
          zipCode: "36010000",
        },
      }),
    );
    const body = await readJson<{
      ok: boolean;
      quotes: Array<{ service: string; priceCents: number }>;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.quotes[0]?.service).toBe("PAC");
  });

  it("returns the wishlist snapshot", async () => {
    const response = await storeWishlistRoute.GET();
    const body = await readJson<{ ok: boolean; items: Array<{ productId: string }> }>(
      response,
    );

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items[0]?.productId).toBe("product-1");
  });

  it("adds products to the wishlist", async () => {
    const response = await storeWishlistRoute.POST(
      jsonRequest("https://example.com/api/store/wishlist", {
        productId: "product-2",
      }),
    );
    const body = await readJson<{ ok: boolean; summary: { count: number } }>(
      response,
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.summary.count).toBe(2);
  });

  it("removes products from the wishlist", async () => {
    const response = await storeWishlistRoute.DELETE(
      jsonRequest("https://example.com/api/store/wishlist", {
        productId: "product-1",
      }),
    );
    const body = await readJson<{ ok: boolean; summary: { count: number } }>(
      response,
    );

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.summary.count).toBe(1);
  });
});
