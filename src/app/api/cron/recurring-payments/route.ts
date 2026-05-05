import { NextResponse } from "next/server";
import { generateRecurringSubscriptionPayments } from "@/lib/billing/recurrence";
import { captureException } from "@/lib/observability/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
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
    const result = await generateRecurringSubscriptionPayments();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    captureException(error, { source: "recurring payments cron" });
    return NextResponse.json(
      { ok: false, error: "Recurring payment generation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
