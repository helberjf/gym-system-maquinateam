import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.VERCEL !== "1";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const [expiredResets, expiredVerifications, usedResets] = await Promise.all([
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.verificationToken.deleteMany({
        where: { expires: { lt: now } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          usedAt: { not: null, lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const summary = {
      expiredPasswordResets: expiredResets.count,
      expiredVerificationTokens: expiredVerifications.count,
      oldUsedPasswordResets: usedResets.count,
    };

    logger.info("cron.cleanup-tokens.completed", summary);

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    logger.error("cron.cleanup-tokens.failed", error);
    return NextResponse.json({ ok: false, error: "Cleanup failed" }, { status: 500 });
  }
}
