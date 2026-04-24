import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 60;

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET nao configurado para assinar tokens de QR check-in.",
    );
  }
  return secret;
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padLength = (4 - (value.length % 4)) % 4;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Buffer.from(normalized, "base64");
}

function sign(payload: string) {
  return base64UrlEncode(
    createHmac("sha256", getSecret()).update(payload).digest(),
  );
}

export type QrCheckinPayload = {
  studentProfileId: string;
  exp: number;
};

export function createStudentCheckinToken(
  studentProfileId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: QrCheckinPayload = { studentProfileId, exp };
  const payloadEncoded = base64UrlEncode(
    Buffer.from(JSON.stringify(payload)),
  );
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export type VerifyResult =
  | { ok: true; payload: QrCheckinPayload }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" };

export function verifyStudentCheckinToken(token: string): VerifyResult {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return { ok: false, reason: "malformed" };
  }

  const expected = sign(payloadEncoded);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return { ok: false, reason: "invalid_signature" };
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: QrCheckinPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof payload.studentProfileId !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
