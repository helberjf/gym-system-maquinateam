import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as nextAuthRoute from "@/app/api/auth/[...nextauth]/route";
import * as forgotPasswordRoute from "@/app/api/auth/forgot-password/route";
import * as registerRoute from "@/app/api/auth/register/route";
import * as resendVerificationRoute from "@/app/api/auth/resend-verification/route";
import * as resetPasswordRoute from "@/app/api/auth/reset-password/route";
import * as cepRoute from "@/app/api/cep/route";
import * as healthRoute from "@/app/api/health/route";
import * as mercadoPagoWebhookRoute from "@/app/api/mercadopago/webhook/route";
import * as publicViewerRoute from "@/app/api/public/viewer/route";
import { jsonRequest, expectRateLimitHeaders, readJson } from "./helpers/api-route";

const mocks = vi.hoisted(() => {
  const rateLimitHeaders = new Headers({ "X-RateLimit-Limit": "99" });

  return {
    rateLimitHeaders,
    after: vi.fn((callback: () => unknown) => callback()),
    authHandlers: {
      GET: vi.fn(async () => new Response("nextauth-get", { status: 200 })),
      POST: vi.fn(async () => new Response("nextauth-post", { status: 200 })),
    },
    registerStudent: vi.fn(
      async (
        _input: unknown,
        _context: unknown,
        options?: { onEmailReady?: (send: () => Promise<void>) => void },
      ) => {
        options?.onEmailReady?.(async () => undefined);

        return {
          ok: true,
          email: "ana@example.com",
          emailSent: true,
          message: "Cadastro recebido.",
          status: 201,
        };
      },
    ),
    requestPasswordReset: vi.fn(async () => ({
      ok: true,
      message: "Email de recuperacao enviado.",
      emailSent: true,
    })),
    resendVerificationEmail: vi.fn(async () => ({
      ok: true,
      message: "Email reenviado.",
      emailSent: true,
    })),
    resetPasswordWithToken: vi.fn(async () => ({
      ok: true,
      message: "Senha redefinida.",
    })),
    enforceRateLimit: vi.fn(async () => ({
      headers: rateLimitHeaders,
    })),
    parseJsonBody: vi.fn(async (request: Request) => request.json()),
    parseSearchParams: vi.fn(
      (input: URLSearchParams | Record<string, unknown>) => {
        const entries =
          input instanceof URLSearchParams
            ? Object.fromEntries(input.entries())
            : input;

        return Object.fromEntries(
          Object.entries(entries).map(([key, value]) => {
            if (typeof value === "string" && /^\d+$/.test(value)) {
              return [key, Number(value)];
            }

            return [key, value];
          }),
        );
      },
    ),
    prisma: {
      $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
    },
    getMailConfigurationStatus: vi.fn(() => ({
      configured: true,
      provider: "resend",
      apiKeyConfigured: true,
      senderConfigured: true,
      issues: [] as string[],
    })),
    verifyMercadoPagoWebhookRequest: vi.fn(async () => undefined),
    parseMercadoPagoWebhookPayload: vi.fn(async () => ({
      eventType: "payment.updated",
      payload: { data: { id: "mp-1" } },
      providerKey: "mercado_pago:mp-1",
      providerObjectId: "mp-1",
    })),
    processMercadoPagoPaymentWebhook: vi.fn(async () => ({
      received: true,
      checkoutPaymentId: "cp-1",
      status: "PAID",
    })),
    getOptionalSession: vi.fn<
      () => Promise<{ user: { id: string; role: string } } | null>
    >(async () => null),
    getCartSummary: vi.fn<
      () => Promise<{
        cartId: string | null;
        authenticated: boolean;
        itemCount: number;
      }>
    >(async () => ({ cartId: null, authenticated: false, itemCount: 0 })),
    getStoreWishlistSummary: vi.fn<() => Promise<{ count: number }>>(async () => ({
      count: 0,
    })),
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");

  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
  handlers: mocks.authHandlers,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/service", () => ({
  registerStudent: mocks.registerStudent,
  requestPasswordReset: mocks.requestPasswordReset,
  resendVerificationEmail: mocks.resendVerificationEmail,
  resetPasswordWithToken: mocks.resetPasswordWithToken,
}));

vi.mock("@/lib/rate-limit", () => ({
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
  forgotPasswordLimiter: { key: "forgot-password" },
  mutationLimiter: { key: "mutation" },
  registerLimiter: { key: "register" },
  resendVerificationLimiter: { key: "resend-verification" },
  resetPasswordLimiter: { key: "reset-password" },
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

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/mail", () => ({
  getMailConfigurationStatus: mocks.getMailConfigurationStatus,
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  parseMercadoPagoWebhookPayload: mocks.parseMercadoPagoWebhookPayload,
  verifyMercadoPagoWebhookRequest: mocks.verifyMercadoPagoWebhookRequest,
}));

vi.mock("@/lib/payments/webhook", () => ({
  processMercadoPagoPaymentWebhook: mocks.processMercadoPagoPaymentWebhook,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSession: mocks.getOptionalSession,
}));

vi.mock("@/lib/store/cart", () => ({
  getCartSummary: mocks.getCartSummary,
}));

vi.mock("@/lib/store/favorites", () => ({
  getStoreWishlistSummary: mocks.getStoreWishlistSummary,
}));

describe("API auth and misc routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("delegates GET to NextAuth handlers", async () => {
    const response = await nextAuthRoute.GET(
      new NextRequest("https://example.com/api/auth/session"),
    );

    expect(mocks.authHandlers.GET).toHaveBeenCalled();
    expect(await response.text()).toBe("nextauth-get");
  });

  it("delegates POST to NextAuth handlers", async () => {
    const response = await nextAuthRoute.POST(
      new NextRequest("https://example.com/api/auth/callback", {
        method: "POST",
      }),
    );

    expect(mocks.authHandlers.POST).toHaveBeenCalled();
    expect(await response.text()).toBe("nextauth-post");
  });

  it("creates a registration response and schedules the deferred email", async () => {
    const response = await registerRoute.POST(
      jsonRequest("https://example.com/api/auth/register", {
        name: "Ana",
        email: "ana@example.com",
        password: "Senha@123",
        confirmPassword: "Senha@123",
      }),
    );

    const body = await readJson<{ ok: boolean; email: string; emailSent: boolean }>(
      response,
    );

    expect(response.status).toBe(201);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.email).toBe("ana@example.com");
    expect(body.emailSent).toBe(true);
    expect(mocks.after).toHaveBeenCalled();
  });

  it("handles forgot-password requests", async () => {
    const response = await forgotPasswordRoute.POST(
      jsonRequest("https://example.com/api/auth/forgot-password", {
        email: "ana@example.com",
      }),
    );

    const body = await readJson<{ ok: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.message).toContain("recuperacao");
  });

  it("handles resend-verification requests", async () => {
    const response = await resendVerificationRoute.POST(
      jsonRequest("https://example.com/api/auth/resend-verification", {
        email: "ana@example.com",
      }),
    );

    const body = await readJson<{ ok: boolean; emailSent: boolean }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(true);
  });

  it("handles reset-password requests", async () => {
    const response = await resetPasswordRoute.POST(
      jsonRequest("https://example.com/api/auth/reset-password", {
        token: "reset-token",
        password: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      }),
    );

    const body = await readJson<{ ok: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.message).toContain("Senha");
  });

  it("looks up CEP data and normalizes the response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cep: "36010-000",
          logradouro: "Rua Halfeld",
          bairro: "Centro",
          localidade: "Juiz de Fora",
          uf: "mg",
          complemento: "loja 1",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const response = await cepRoute.GET(
      new Request("https://example.com/api/cep?cep=36010000"),
    );

    const body = await readJson<{
      ok: boolean;
      zipCode: string;
      street: string;
      city: string;
      state: string;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.zipCode).toBe("36010000");
    expect(body.street).toBe("Rua Halfeld");
    expect(body.city).toBe("Juiz de Fora");
    expect(body.state).toBe("MG");
  });

  it("reports a healthy system status when db and mail are available", async () => {
    const response = await healthRoute.GET();
    const body = await readJson<{
      ok: boolean;
      status: string;
      services: { db: string; mail: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.services).toEqual({
      db: "ok",
      mail: "ok",
    });
  });

  it("reports a degraded system status when the database is unavailable", async () => {
    mocks.prisma.$queryRaw.mockRejectedValueOnce(new Error("db down"));
    mocks.getMailConfigurationStatus.mockReturnValueOnce({
      configured: false,
      provider: "resend",
      apiKeyConfigured: true,
      senderConfigured: false,
      issues: ["missing from address"],
    });

    const response = await healthRoute.GET();
    const body = await readJson<{
      ok: boolean;
      status: string;
      services: { db: string; mail: string };
    }>(response);

    expect(response.status).toBe(503);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("degraded");
    expect(body.services).toEqual({
      db: "error",
      mail: "error",
    });
  });

  it("processes Mercado Pago webhooks through the payment sync pipeline", async () => {
    const response = await mercadoPagoWebhookRoute.POST(
      jsonRequest("https://example.com/api/mercadopago/webhook", {}),
    );

    const body = await readJson<{
      ok: boolean;
      received: boolean;
      checkoutPaymentId: string;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.received).toBe(true);
    expect(body.checkoutPaymentId).toBe("cp-1");
    expect(mocks.verifyMercadoPagoWebhookRequest).toHaveBeenCalled();
    expect(mocks.parseMercadoPagoWebhookPayload).toHaveBeenCalled();
    expect(mocks.processMercadoPagoPaymentWebhook).toHaveBeenCalledWith({
      eventType: "payment.updated",
      payload: { data: { id: "mp-1" } },
      providerKey: "mercado_pago:mp-1",
      providerObjectId: "mp-1",
    });
  });

  it("returns viewer state for an unauthenticated guest", async () => {
    mocks.getOptionalSession.mockResolvedValueOnce(null);
    mocks.getCartSummary.mockResolvedValueOnce({ cartId: null, authenticated: false, itemCount: 0 });
    mocks.getStoreWishlistSummary.mockResolvedValueOnce({ count: 0 });

    const response = await publicViewerRoute.GET(
      new Request("https://example.com/api/public/viewer"),
    );
    const body = await readJson<{
      ok: boolean;
      isAuthenticated: boolean;
      cartCount: number;
      wishlistCount: number;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.isAuthenticated).toBe(false);
    expect(body.cartCount).toBe(0);
    expect(body.wishlistCount).toBe(0);
  });

  it("returns viewer state for an authenticated user with cart and wishlist items", async () => {
    mocks.getOptionalSession.mockResolvedValueOnce({ user: { id: "user-1", role: "STUDENT" } });
    mocks.getCartSummary.mockResolvedValueOnce({ cartId: "cart-1", authenticated: true, itemCount: 3 });
    mocks.getStoreWishlistSummary.mockResolvedValueOnce({ count: 2 });

    const response = await publicViewerRoute.GET(
      new Request("https://example.com/api/public/viewer"),
    );
    const body = await readJson<{
      ok: boolean;
      isAuthenticated: boolean;
      cartCount: number;
      wishlistCount: number;
    }>(response);

    expect(response.status).toBe(200);
    expectRateLimitHeaders(response);
    expect(body.ok).toBe(true);
    expect(body.isAuthenticated).toBe(true);
    expect(body.cartCount).toBe(3);
    expect(body.wishlistCount).toBe(2);
  });
});
