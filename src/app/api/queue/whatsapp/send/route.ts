import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/messaging/whatsapp";
import { captureException } from "@/lib/observability/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = { to?: unknown; message?: unknown };

async function verifySignature(
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
    captureException(error, { source: "qstash whatsapp signature" });
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const valid = await verifySignature(request, rawBody);
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  let payload: Payload;
  try {
    payload = JSON.parse(rawBody) as Payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (typeof payload.to !== "string" || typeof payload.message !== "string") {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 },
    );
  }

  try {
    const result = await sendWhatsAppText({
      to: payload.to,
      message: payload.message,
    });
    return NextResponse.json({ ok: result.ok, provider: result.provider });
  } catch (error) {
    captureException(error, { source: "qstash whatsapp send" });
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 500 },
    );
  }
}
