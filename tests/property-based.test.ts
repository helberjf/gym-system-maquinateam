import { beforeEach, afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import { calculateLevel } from "@/lib/academy/gamification";
import { normalizeBrazilianPhone } from "@/lib/messaging/whatsapp";
import {
  createStudentCheckinToken,
  verifyStudentCheckinToken,
} from "@/lib/academy/qr-token";

const originalAuthSecret = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-property-tests";
});

afterEach(() => {
  process.env.AUTH_SECRET = originalAuthSecret;
});

describe("property: calculateLevel", () => {
  it("progressPercent is always within [0, 100]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (points) => {
        const result = calculateLevel(points);
        expect(result.progressPercent).toBeGreaterThanOrEqual(0);
        expect(result.progressPercent).toBeLessThanOrEqual(100);
      }),
    );
  });

  it("level is non-decreasing in points", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        (a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          const lowLevel = calculateLevel(low).level;
          const highLevel = calculateLevel(high).level;
          expect(highLevel).toBeGreaterThanOrEqual(lowLevel);
        },
      ),
    );
  });

  it("currentPoints echoes input exactly", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (points) => {
        expect(calculateLevel(points).currentPoints).toBe(points);
      }),
    );
  });

  it("returns capped progress (100) at the final threshold", () => {
    const result = calculateLevel(10_000_000);
    expect(result.pointsForNextLevel).toBeNull();
    expect(result.progressPercent).toBe(100);
  });
});

describe("property: normalizeBrazilianPhone", () => {
  it("is idempotent for valid inputs", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^55\d{10,11}$/),
        (phone) => {
          const first = normalizeBrazilianPhone(phone);
          if (first === null) {
            return;
          }
          const second = normalizeBrazilianPhone(first);
          expect(second).toBe(first);
        },
      ),
    );
  });

  it("returns null for inputs with fewer than 10 digits", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{0,9}$/),
        (value) => {
          expect(normalizeBrazilianPhone(value)).toBeNull();
        },
      ),
    );
  });

  it("ignores non-digit characters", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{11}$/),
        fc.stringMatching(/^[-()\s.]+$/),
        (digits, noise) => {
          const dirty = digits
            .split("")
            .map((digit, index) => (index === 3 ? `${noise}${digit}` : digit))
            .join("");
          expect(normalizeBrazilianPhone(dirty)).toBe(
            normalizeBrazilianPhone(digits),
          );
        },
      ),
    );
  });
});

describe("property: QR check-in token round trip", () => {
  it("always verifies valid tokens back to the same studentProfileId", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{6,40}$/),
        (studentProfileId) => {
          const token = createStudentCheckinToken(studentProfileId);
          const verified = verifyStudentCheckinToken(token);
          expect(verified.ok).toBe(true);
          if (verified.ok) {
            expect(verified.payload.studentProfileId).toBe(studentProfileId);
          }
        },
      ),
    );
  });

  it("rejects any tampered token with random suffixes", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{6,20}$/),
        fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/),
        (studentProfileId, suffix) => {
          const token = createStudentCheckinToken(studentProfileId);
          const tampered = `${token}${suffix}`;
          const verified = verifyStudentCheckinToken(tampered);
          expect(verified.ok).toBe(false);
        },
      ),
    );
  });
});
