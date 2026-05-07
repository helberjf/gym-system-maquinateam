import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { sendDailyClassReminders } from "@/lib/messaging/class-reminders";
import { captureException } from "@/lib/observability/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFallbackAuthorized(request: Request) {
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

async function verifyQstashSignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  const signature = request.headers.get("upstash-signature");

  if (!signature || !currentSigningKey || !nextSigningKey) {
    return false;
  }

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });

  try {
    return await receiver.verify({
      body: rawBody,
      signature,
      url: request.url,
    });
  } catch (error) {
    captureException(error, { source: "qstash signature verify" });
    return false;
  }
}

async function handle(request: Request) {
  const rawBody = await request.text().catch(() => "");

  const hasQstashConfig =
    !!process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() &&
    !!process.env.QSTASH_NEXT_SIGNING_KEY?.trim();

  if (hasQstashConfig) {
    const signatureOk = await verifyQstashSignature(request, rawBody);
    if (!signatureOk) {
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 },
      );
    }
  } else if (!isFallbackAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await sendDailyClassReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    captureException(error, { source: "class reminders cron" });
    return NextResponse.json(
      { ok: false, error: "Reminders failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
