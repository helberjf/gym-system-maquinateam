import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createStudentCheckinToken,
  verifyStudentCheckinToken,
} from "@/lib/academy/qr-token";

const originalSecret = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-qr-token";
});

afterEach(() => {
  process.env.AUTH_SECRET = originalSecret;
});

describe("QR check-in tokens", () => {
  it("round-trips a valid token", () => {
    const token = createStudentCheckinToken("student-1");
    const verified = verifyStudentCheckinToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.studentProfileId).toBe("student-1");
    }
  });

  it("rejects tokens signed with a different secret", () => {
    const token = createStudentCheckinToken("student-1");
    process.env.AUTH_SECRET = "another-secret";
    const verified = verifyStudentCheckinToken(token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toBe("invalid_signature");
    }
  });

  it("rejects malformed tokens", () => {
    expect(verifyStudentCheckinToken("not-a-token").ok).toBe(false);
    expect(verifyStudentCheckinToken("abc.def.extra").ok).toBe(false);
    expect(verifyStudentCheckinToken("").ok).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = createStudentCheckinToken("student-1", -10);
    const verified = verifyStudentCheckinToken(token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toBe("expired");
    }
  });

  it("rejects tampered payload", () => {
    const token = createStudentCheckinToken("student-1");
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        studentProfileId: "attacker",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const verified = verifyStudentCheckinToken(`${forgedPayload}.${signature}`);
    expect(verified.ok).toBe(false);
  });
});
