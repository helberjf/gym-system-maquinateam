import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    pushSubscription: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  webPush: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("web-push", () => ({
  default: mocks.webPush,
  setVapidDetails: mocks.webPush.setVapidDetails,
  sendNotification: mocks.webPush.sendNotification,
}));

import {
  deleteSubscription,
  getPublicVapidKey,
  saveSubscription,
  sendPushToUser,
} from "@/lib/push/service";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  mocks.prisma.pushSubscription.findMany.mockResolvedValue([]);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("getPublicVapidKey", () => {
  it("returns null when not configured", () => {
    expect(getPublicVapidKey()).toBeNull();
  });

  it("returns the env value when set", () => {
    process.env.VAPID_PUBLIC_KEY = "BPubKey";
    expect(getPublicVapidKey()).toBe("BPubKey");
  });
});

describe("saveSubscription", () => {
  it("upserts by endpoint and stores keys/userAgent", async () => {
    mocks.prisma.pushSubscription.upsert.mockResolvedValue({ id: "ps-1" });

    await saveSubscription({
      userId: "u-1",
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p", auth: "a" },
      userAgent: "ua-1",
    });

    expect(mocks.prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: "https://push.example.com/abc" },
        create: expect.objectContaining({
          userId: "u-1",
          p256dh: "p",
          auth: "a",
          userAgent: "ua-1",
        }),
      }),
    );
  });
});

describe("deleteSubscription", () => {
  it("scopes deletion to (endpoint, userId)", async () => {
    mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    await deleteSubscription("https://push.example.com/abc", "u-1");
    expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        endpoint: "https://push.example.com/abc",
        userId: "u-1",
      },
    });
  });
});

describe("sendPushToUser", () => {
  it("returns skipped=true when VAPID is not configured", async () => {
    const result = await sendPushToUser("u-1", { title: "x", body: "y" });
    expect(result).toEqual({ sent: 0, removed: 0, skipped: true });
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("sends to each subscription when configured", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
    ]);
    mocks.webPush.sendNotification.mockResolvedValue(undefined);

    const result = await sendPushToUser("u-1", { title: "x", body: "y" });

    expect(result.sent).toBe(2);
    expect(mocks.webPush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("removes subscriptions that returned 410 (gone)", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "e2", p256dh: "p2", auth: "a2" },
    ]);
    mocks.webPush.sendNotification.mockImplementation(
      async (subscription: { endpoint: string }) => {
        if (subscription.endpoint === "e2") {
          throw Object.assign(new Error("Gone"), { statusCode: 410 });
        }
      },
    );
    mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

    const result = await sendPushToUser("u-1", { title: "x", body: "y" });

    expect(result.sent).toBe(1);
    expect(result.removed).toBe(1);
    expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s2"] } },
    });
  });

  it("logs but does not remove on transient 5xx errors", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([
      { id: "s1", endpoint: "e1", p256dh: "p1", auth: "a1" },
    ]);
    mocks.webPush.sendNotification.mockRejectedValue(
      Object.assign(new Error("svc unavailable"), { statusCode: 503 }),
    );

    const result = await sendPushToUser("u-1", { title: "x", body: "y" });

    expect(result.sent).toBe(0);
    expect(result.removed).toBe(0);
    expect(mocks.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
