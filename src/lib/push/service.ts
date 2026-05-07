import "server-only";
import { Prisma } from "@prisma/client";
import { logger, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let cachedClient: typeof import("web-push") | null = null;
let cachedConfigured = false;

async function getWebPush() {
  if (cachedClient && cachedConfigured) return cachedClient;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ?? "mailto:contato@maquinateam.com";

  if (!publicKey || !privateKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = await import("web-push");
  }
  if (!cachedConfigured) {
    cachedClient.setVapidDetails(subject, publicKey, privateKey);
    cachedConfigured = true;
  }
  return cachedClient;
}

export function getPublicVapidKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? null;
}

export type SaveSubscriptionInput = {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
};

export async function saveSubscription(input: SaveSubscriptionInput) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userId: input.userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
    },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function deleteSubscription(endpoint: string, userId: string) {
  return prisma.pushSubscription.deleteMany({
    where: { endpoint, userId },
  });
}

export async function listSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Sends a push notification to all subscriptions of a user.
 * Returns counts of successes / removed (gone subscriptions auto-pruned).
 * No-op when VAPID is not configured.
 */
export async function sendPushToUser(
  userId: string,
  payload: WebPushPayload,
): Promise<{ sent: number; removed: number; skipped: boolean }> {
  const client = await getWebPush();
  if (!client) {
    return { sent: 0, removed: 0, skipped: true };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  let removed = 0;
  const goneIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await client.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (error) {
        const status =
          (error as { statusCode?: number } | null)?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          goneIds.push(sub.id);
        } else {
          logger.warn("push.send_failed", {
            userId,
            endpoint: sub.endpoint,
            statusCode: status,
            error: serializeError(error),
          });
        }
      }
    }),
  );

  if (goneIds.length > 0) {
    const result = await prisma.pushSubscription.deleteMany({
      where: { id: { in: goneIds } },
    });
    removed = result.count;
  } else {
    // Update lastUsedAt on the still-active subscriptions
    if (sent > 0) {
      try {
        await prisma.pushSubscription.updateMany({
          where: { userId },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        // Non-fatal; ignore.
        logger.debug("push.last_used_update_failed", {
          userId,
          error: serializeError(error),
        });
      }
    }
  }

  return { sent, removed, skipped: false };
}

export type PushSubscriptionRow = Prisma.PushSubscriptionGetPayload<{
  select: {
    id: true;
    endpoint: true;
    userAgent: true;
    createdAt: true;
    lastUsedAt: true;
  };
}>;
