import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pixStatusRoute from "@/app/api/payments/pix/status/route";

const mocks = vi.hoisted(() => ({
  getOptionalSession: vi.fn(async () => null),
  getPixCheckoutStatus: vi.fn(async (input: { checkoutPaymentId: string }) => ({
    checkoutPaymentId: input.checkoutPaymentId,
    paymentId: "pix_char_test",
    kind: "PLAN_SUBSCRIPTION",
    amountCents: 12900,
    status: "PENDING",
    providerStatus: "PENDING",
    brCode: "00020101...",
    qrCodeImage: "base64-qr",
    expiresAt: "2026-05-07T02:49:58.550Z",
    syncError: null,
    orderId: null,
    orderNumber: null,
    subscriptionId: "sub-1",
    planName: "Mensal 1x na Semana",
  })),
  enforceRateLimit: vi.fn(async () => ({
    headers: new Headers({ "X-RateLimit-Limit": "99" }),
  })),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSession: mocks.getOptionalSession,
}));

vi.mock("@/lib/payments/pix", () => ({
  getPixCheckoutStatus: mocks.getPixCheckoutStatus,
}));

vi.mock("@/lib/rate-limit", () => ({
  attachRateLimitHeaders: (response: Response, headers?: HeadersInit) => {
    if (!headers) {
      return response;
    }

    new Headers(headers).forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  },
  enforceRateLimit: mocks.enforceRateLimit,
  pixStatusLimiter: { key: "pix-status" },
}));

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

describe("GET /api/payments/pix/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts Prisma CUID checkout payment ids", async () => {
    const paymentId = "cmoutwi7u0008ho3wenj8x58t";
    const response = await pixStatusRoute.GET(
      new Request(
        `https://example.com/api/payments/pix/status?payment=${paymentId}`,
      ),
    );
    const body = await readJson<{
      ok: boolean;
      checkoutPaymentId: string;
      planName: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("99");
    expect(body.ok).toBe(true);
    expect(body.checkoutPaymentId).toBe(paymentId);
    expect(body.planName).toBe("Mensal 1x na Semana");
    expect(mocks.getPixCheckoutStatus).toHaveBeenCalledWith({
      checkoutPaymentId: paymentId,
      userId: null,
    });
  });

  it("rejects malformed checkout payment ids before querying status", async () => {
    const response = await pixStatusRoute.GET(
      new Request(
        "https://example.com/api/payments/pix/status?payment=checkout-payment-1",
      ),
    );
    const body = await readJson<{ ok: boolean; error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ID de pagamento invalido.");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.getPixCheckoutStatus).not.toHaveBeenCalled();
  });
});
