import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcilePendingPixCheckouts: vi.fn(),
  sendDailyClassReminders: vi.fn(),
  qstashVerify: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/payments/pix-reconciliation", () => ({
  reconcilePendingPixCheckouts: mocks.reconcilePendingPixCheckouts,
}));

vi.mock("@/lib/messaging/class-reminders", () => ({
  sendDailyClassReminders: mocks.sendDailyClassReminders,
}));

vi.mock("@/lib/observability/capture", () => ({
  captureException: mocks.captureException,
}));

vi.mock("@upstash/qstash", () => ({
  Receiver: class {
    verify = mocks.qstashVerify;
  },
}));

import * as reconcilePixRoute from "@/app/api/cron/reconcile-pix/route";
import * as classRemindersRoute from "@/app/api/cron/class-reminders/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CRON_SECRET;
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
  delete process.env.VERCEL;
  vi.stubEnv("NODE_ENV", "test");
  mocks.reconcilePendingPixCheckouts.mockResolvedValue({ checked: 0, ok: true });
  mocks.sendDailyClassReminders.mockResolvedValue({ sent: 0 });
  mocks.qstashVerify.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = ORIGINAL_ENV;
});

function makeRequest(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

describe("/api/cron/reconcile-pix", () => {
  it("returns 401 in production when CRON_SECRET is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await reconcilePixRoute.GET(
      makeRequest("https://example.com/api/cron/reconcile-pix"),
    );
    expect(response.status).toBe(401);
    expect(mocks.reconcilePendingPixCheckouts).not.toHaveBeenCalled();
  });

  it("returns 401 in production when Authorization header is wrong", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CRON_SECRET = "rotating-secret";
    const response = await reconcilePixRoute.GET(
      makeRequest("https://example.com/api/cron/reconcile-pix", {
        headers: { authorization: "Bearer WRONG" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("authorizes in production with the correct Bearer token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CRON_SECRET = "rotating-secret";
    const response = await reconcilePixRoute.GET(
      makeRequest("https://example.com/api/cron/reconcile-pix", {
        headers: { authorization: "Bearer rotating-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.reconcilePendingPixCheckouts).toHaveBeenCalled();
  });

  it("authorizes in development without secret (dev convenience)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await reconcilePixRoute.GET(
      makeRequest("https://example.com/api/cron/reconcile-pix"),
    );
    expect(response.status).toBe(200);
  });

  it("returns 500 with sanitized message when reconciliation throws", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.reconcilePendingPixCheckouts.mockRejectedValueOnce(
      new Error("DB exploded with secret leaks: token=abc123"),
    );
    const response = await reconcilePixRoute.GET(
      makeRequest("https://example.com/api/cron/reconcile-pix"),
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toMatch(/secret/i);
    expect(body.error).not.toMatch(/token=abc123/);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("/api/cron/class-reminders", () => {
  it("returns 401 in production when neither QStash signing keys nor CRON_SECRET are set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await classRemindersRoute.POST(
      makeRequest("https://example.com/api/cron/class-reminders", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("verifies QStash signature when both signing keys are present", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = "current";
    process.env.QSTASH_NEXT_SIGNING_KEY = "next";
    mocks.qstashVerify.mockResolvedValueOnce(true);

    const response = await classRemindersRoute.POST(
      makeRequest("https://example.com/api/cron/class-reminders", {
        method: "POST",
        body: '{"foo":"bar"}',
        headers: { "upstash-signature": "valid" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.qstashVerify).toHaveBeenCalledOnce();
    expect(mocks.sendDailyClassReminders).toHaveBeenCalled();
  });

  it("returns 401 when QStash signature is invalid", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = "current";
    process.env.QSTASH_NEXT_SIGNING_KEY = "next";
    mocks.qstashVerify.mockResolvedValueOnce(false);

    const response = await classRemindersRoute.POST(
      makeRequest("https://example.com/api/cron/class-reminders", {
        method: "POST",
        body: '{"foo":"bar"}',
        headers: { "upstash-signature": "invalid" },
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.sendDailyClassReminders).not.toHaveBeenCalled();
  });

  it("falls back to CRON_SECRET when QStash keys are absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CRON_SECRET = "fallback-secret";

    const okResponse = await classRemindersRoute.POST(
      makeRequest("https://example.com/api/cron/class-reminders", {
        method: "POST",
        body: "{}",
        headers: { authorization: "Bearer fallback-secret" },
      }),
    );
    expect(okResponse.status).toBe(200);
  });
});
