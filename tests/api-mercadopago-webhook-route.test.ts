import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(async () => ({ headers: new Headers() })),
  attachRateLimitHeaders: vi.fn((response: Response) => response),
  verifyMercadoPagoWebhookRequest: vi.fn(),
  parseMercadoPagoWebhookPayload: vi.fn(),
  processMercadoPagoPaymentWebhook: vi.fn(),
  withTrace: vi.fn(async (_label: string, fn: (trace: { traceId: string }) => unknown) =>
    fn({ traceId: "trace-1" }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  attachRateLimitHeaders: mocks.attachRateLimitHeaders,
  mutationLimiter: { key: "mutation", limit: 30, windowMs: 60_000, message: "" },
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  verifyMercadoPagoWebhookRequest: mocks.verifyMercadoPagoWebhookRequest,
  parseMercadoPagoWebhookPayload: mocks.parseMercadoPagoWebhookPayload,
}));

vi.mock("@/lib/payments/webhook", () => ({
  processMercadoPagoPaymentWebhook: mocks.processMercadoPagoPaymentWebhook,
}));

vi.mock("@/lib/observability/tracing", () => ({
  withTrace: mocks.withTrace,
  sendAlert: vi.fn(async () => undefined),
}));

import * as webhookRoute from "@/app/api/mercadopago/webhook/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue({ headers: new Headers() });
  mocks.parseMercadoPagoWebhookPayload.mockResolvedValue({
    payload: { data: { id: "999" } },
    providerObjectId: "999",
    providerKey: "mercado_pago:999",
    eventType: "payment.updated",
  });
  mocks.processMercadoPagoPaymentWebhook.mockResolvedValue({
    received: true,
    checkoutPaymentId: "cp-1",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildRequest(url = "https://example.com/api/mercadopago/webhook?data.id=999") {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": "ts=123,v1=abc",
      "x-request-id": "req-1",
    },
    body: JSON.stringify({ data: { id: "999" } }),
  });
}

describe("POST /api/mercadopago/webhook", () => {
  it("returns 200 on valid webhook flow", async () => {
    const response = await webhookRoute.POST(buildRequest());
    expect(response.status).toBe(200);
    expect(mocks.verifyMercadoPagoWebhookRequest).toHaveBeenCalled();
    expect(mocks.processMercadoPagoPaymentWebhook).toHaveBeenCalled();
  });

  it("returns 401 when signature verification fails", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    mocks.verifyMercadoPagoWebhookRequest.mockRejectedValueOnce(
      new UnauthorizedError("Assinatura do webhook invalida."),
    );

    const response = await webhookRoute.POST(buildRequest());
    expect(response.status).toBe(401);
    expect(mocks.processMercadoPagoPaymentWebhook).not.toHaveBeenCalled();
  });

  it("does not crash when payload has no data.id; surface 400", async () => {
    const { BadRequestError } = await import("@/lib/errors");
    mocks.parseMercadoPagoWebhookPayload.mockRejectedValueOnce(
      new BadRequestError("Webhook sem identificador de pagamento."),
    );

    const response = await webhookRoute.POST(
      new Request("https://example.com/api/mercadopago/webhook", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("propagates 429 when rate limit is exceeded", async () => {
    const { TooManyRequestsError } = await import("@/lib/errors");
    mocks.enforceRateLimit.mockRejectedValueOnce(
      new TooManyRequestsError("Webhook rate limit excedido.", {
        headers: new Headers({ "Retry-After": "60" }),
        retryAfterSeconds: 60,
      }),
    );

    const response = await webhookRoute.POST(buildRequest());
    expect(response.status).toBe(429);
  });

  it("never echoes internal stack traces in error responses", async () => {
    mocks.processMercadoPagoPaymentWebhook.mockRejectedValueOnce(
      new Error("DATABASE_URL=postgres://leaked-secret"),
    );

    const response = await webhookRoute.POST(buildRequest());
    const body = await response.text();
    expect(body).not.toMatch(/leaked-secret/);
    expect(body).not.toMatch(/postgres:\/\//);
  });
});
