import { NextResponse } from "next/server";
import { captureException } from "@/lib/observability/capture";
import { reconcilePendingPixCheckouts } from "@/lib/payments/pix-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    // In production we never accept calls without a secret — even outside
    // Vercel's cron infrastructure (e.g. self-hosted) the endpoint must require
    // an explicit Authorization header.
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await reconcilePendingPixCheckouts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    captureException(error, { source: "pix reconciliation cron" });
    return NextResponse.json(
      { ok: false, error: "Reconciliation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
