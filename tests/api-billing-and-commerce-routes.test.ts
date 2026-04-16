import { beforeEach, describe, expect, it, vi } from "vitest";
import * as paymentsRoute from "@/app/api/payments/route";
import * as paymentsIdRoute from "@/app/api/payments/[id]/route";
import * as plansRoute from "@/app/api/plans/route";
import * as plansIdRoute from "@/app/api/plans/[id]/route";
import * as planCheckoutRoute from "@/app/api/plans/[id]/checkout/route";
import * as productSalesRoute from "@/app/api/product-sales/route";
import * as productsRoute from "@/app/api/products/route";
import * as productsIdRoute from "@/app/api/products/[id]/route";
import * as subscriptionsRoute from "@/app/api/subscriptions/route";
import * as subscriptionsIdRoute from "@/app/api/subscriptions/[id]/route";
import * as uploadsPresignRoute from "@/app/api/uploads/presign/route";
import * as uploadsProductImagesRoute from "@/app/api/uploads/product-images/route";
import {
  expectRateLimitHeaders,
  jsonRequest,
  paramsContext,
  readJson,
} from "./helpers/api-route";

const mocks = vi.hoisted(() => {
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
    },
  };
  const rateLimitHeaders = new Headers({ "X-RateLimit-Limit": "99" });

  return {
    session,
    rateLimitHeaders,
    requireApiPermission: vi.fn(async () => session),
    enforceRateLimit: vi.fn(async () => ({
      headers: rateLimitHeaders,
    })),
    parseJsonBody: vi.fn(async (request: Request) => request.json()),
    validateUploadFile: vi.fn((file: File) => ({
      file,
      safeFilename: file.name,
      extension: file.name.split(".").pop() ?? "",
      sizeBytes: file.size,
      mimeType: file.type,
    })),
    createPayment: vi.fn(async () => ({ id: "payment-1" })),
    updatePayment: vi.fn(async () => ({ id: "payment-1" })),
    cancelPayment: vi.fn(async () => undefined),
    createPlan: vi.fn(async () => ({ id: "plan-1" })),
    updatePlan: vi.fn(async () => ({ id: "plan-1" })),
    archivePlan: vi.fn(async () => undefined),
    createSubscription: vi.fn(async () => ({ id: "subscription-1" })),
    updateSubscription: vi.fn(async () => ({ id: "subscription-1" })),
    cancelSubscription: vi.fn(async () => undefined),
    createPlanCheckoutSession: vi.fn(async () => ({
      subscriptionId: "subscription-1",
      redirectUrl: "https://example.com/checkout/plan",
      reused: false,
    })),
    createProductSale: vi.fn(async () => ({ id: "sale-1" })),
    createProduct: vi.fn(async () => ({ id: "product-1" })),
    updateProduct: vi.fn(async () => ({ id: "product-1" })),
    archiveProduct: vi.fn(async () => undefined),
    createPresignedUploadUrl: vi.fn(async ({ filename, prefix }) => ({
      url: `https://files.example.com/${prefix}/${filename}`,
      storageKey: `${prefix}/${filename}`,
    })),
    uploadToR2: vi.fn(async ({ filename, prefix }) => ({
      url: `https://files.example.com/${prefix}/${filename}`,
      storageKey: `${prefix}/${filename}`,
    })),
  };
});

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
  uploadLimiter: { key: "upload" },
}));

vi.mock("@/lib/validators", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validators")>(
    "@/lib/validators",
  );

  return {
    ...actual,
    parseJsonBody: mocks.parseJsonBody,
    validateUploadFile: mocks.validateUploadFile,
  };
});

vi.mock("@/lib/billing/service", () => ({
  createPayment: mocks.createPayment,
  updatePayment: mocks.updatePayment,
  cancelPayment: mocks.cancelPayment,
  createPlan: mocks.createPlan,
  updatePlan: mocks.updatePlan,
  archivePlan: mocks.archivePlan,
  createSubscription: mocks.createSubscription,
  updateSubscription: mocks.updateSubscription,
  cancelSubscription: mocks.cancelSubscription,
}));

vi.mock("@/lib/billing/self-service", () => ({
  createPlanCheckoutSession: mocks.createPlanCheckoutSession,
}));

vi.mock("@/lib/commerce/service", () => ({
  createProductSale: mocks.createProductSale,
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
  archiveProduct: mocks.archiveProduct,
}));

vi.mock("@/lib/uploads/r2", () => ({
  createPresignedUploadUrl: mocks.createPresignedUploadUrl,
  uploadToR2: mocks.uploadToR2,
}));

describe("Billing and commerce API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createCases = [
    {
      name: "creates payments",
      handler: paymentsRoute.POST,
      request: jsonRequest("https://example.com/api/payments", {
        studentProfileId: "student-1",
        subscriptionId: "subscription-1",
      }),
      expectedStatus: 201,
      expectedKey: "paymentId",
      expectedValue: "payment-1",
    },
    {
      name: "creates plans",
      handler: plansRoute.POST,
      request: jsonRequest("https://example.com/api/plans", {
        name: "Plano Mensal",
      }),
      expectedStatus: 201,
      expectedKey: "planId",
      expectedValue: "plan-1",
    },
    {
      name: "creates product sales",
      handler: productSalesRoute.POST,
      request: jsonRequest("https://example.com/api/product-sales", {
        productId: "product-1",
      }),
      expectedStatus: 201,
      expectedKey: "saleId",
      expectedValue: "sale-1",
    },
    {
      name: "creates products",
      handler: productsRoute.POST,
      request: jsonRequest("https://example.com/api/products", {
        sku: "PROD-1",
        name: "Luva",
        slug: "luva",
      }),
      expectedStatus: 201,
      expectedKey: "productId",
      expectedValue: "product-1",
    },
    {
      name: "creates subscriptions",
      handler: subscriptionsRoute.POST,
      request: jsonRequest("https://example.com/api/subscriptions", {
        studentProfileId: "student-1",
      }),
      expectedStatus: 201,
      expectedKey: "subscriptionId",
      expectedValue: "subscription-1",
    },
  ] as const;

  for (const testCase of createCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(testCase.request);
      const body = await readJson<Record<string, unknown>>(response);

      expect(response.status).toBe(testCase.expectedStatus);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body[testCase.expectedKey]).toEqual(testCase.expectedValue);
    });
  }

  const updateCases = [
    {
      name: "updates payments",
      handler: paymentsIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/payments/payment-1", {
        status: "PAID",
      }),
      expectedKey: "paymentId",
      expectedValue: "payment-1",
    },
    {
      name: "updates plans",
      handler: plansIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/plans/plan-1", {
        name: "Plano Atualizado",
      }),
      expectedKey: "planId",
      expectedValue: "plan-1",
    },
    {
      name: "updates products",
      handler: productsIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/products/product-1", {
        name: "Luva Pro",
      }),
      expectedKey: "productId",
      expectedValue: "product-1",
    },
    {
      name: "updates subscriptions",
      handler: subscriptionsIdRoute.PATCH,
      request: jsonRequest("https://example.com/api/subscriptions/subscription-1", {
        status: "ACTIVE",
      }),
      expectedKey: "subscriptionId",
      expectedValue: "subscription-1",
    },
  ] as const;

  for (const testCase of updateCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(
        testCase.request,
        paramsContext({ id: "resource-1" }),
      );
      const body = await readJson<Record<string, unknown>>(response);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body[testCase.expectedKey]).toEqual(testCase.expectedValue);
    });
  }

  const deleteCases = [
    {
      name: "cancels payments",
      handler: paymentsIdRoute.DELETE,
    },
    {
      name: "archives plans",
      handler: plansIdRoute.DELETE,
    },
    {
      name: "archives products",
      handler: productsIdRoute.DELETE,
    },
    {
      name: "cancels subscriptions",
      handler: subscriptionsIdRoute.DELETE,
    },
  ] as const;

  for (const testCase of deleteCases) {
    it(testCase.name, async () => {
      const response = await testCase.handler(
        new Request("https://example.com/api/resource/resource-1", {
          method: "DELETE",
        }),
        paramsContext({ id: "resource-1" }),
      );
      const body = await readJson<{ ok: boolean; message: string }>(response);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response);
      expect(body.ok).toBe(true);
      expect(body.message.length).toBeGreaterThan(0);
    });
  }

  it("starts self-service plan checkout sessions", async () => {
    const response = await planCheckoutRoute.POST(
      jsonRequest("https://example.com/api/plans/plan-1/checkout", {
        paymentMethod: "PIX",
      }),
      paramsContext({ id: "plan-1" }),
    );
    const body = await readJson<{
      ok: boolean;
      subscriptionId: string;
      redirectUrl: string;
      reused: boolean;
    }>(response);

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.subscriptionId).toBe("subscription-1");
    expect(body.redirectUrl).toContain("/checkout/plan");
    expect(body.reused).toBe(false);
  });

  it("generates presigned upload URLs for product images", async () => {
    const response = await uploadsPresignRoute.POST(
      jsonRequest("https://example.com/api/uploads/presign", {
        prefix: "products",
        files: [
          {
            filename: "luva.jpg",
            contentType: "image/jpeg",
            sizeBytes: 1024,
          },
        ],
      }),
    );
    const body = await readJson<{
      ok: boolean;
      files: Array<{ url: string; storageKey: string }>;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.files[0]?.url).toContain("luva.jpg");
  });

  it("uploads product images to R2", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["image-data"], "luva.jpg", { type: "image/jpeg" }),
    );

    const response = await uploadsProductImagesRoute.POST(
      new Request("https://example.com/api/uploads/product-images", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await readJson<{
      ok: boolean;
      images: Array<{ url: string; storageKey: string }>;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.images[0]?.storageKey).toContain("products/luva.jpg");
  });
});
