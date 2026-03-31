import { describe, expect, it } from "vitest";
import {
  attachRateLimitHeaders,
  checkRateLimit,
  enforceRateLimit,
} from "@/lib/rate-limit";
import { TooManyRequestsError } from "@/lib/errors";

describe("rate limit smoke tests", () => {
  it("returns rate limit headers for successful requests", async () => {
    const identifier = `rate-limit-success-${Date.now()}`;
    const result = await checkRateLimit({
      request: new Request("http://localhost/test"),
      limiter: {
        key: "test-success",
        limit: 2,
        windowMs: 5_000,
        message: "Limite atingido",
      },
      identifier,
    });

    const response = attachRateLimitHeaders(new Response("ok"), result.headers);

    expect(result.success).toBe(true);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.headers.get("X-RateLimit-Remaining")).not.toBeNull();
  });

  it("blocks after the configured number of attempts in memory fallback", async () => {
    const identifier = `rate-limit-block-${Date.now()}`;
    const limiter = {
      key: "test-block",
      limit: 1,
      windowMs: 5_000,
      message: "Limite atingido",
    };

    await enforceRateLimit({
      request: new Request("http://localhost/test"),
      limiter,
      identifier,
    });

    await expect(
      enforceRateLimit({
        request: new Request("http://localhost/test"),
        limiter,
        identifier,
      }),
    ).rejects.toBeInstanceOf(TooManyRequestsError);
  });
});
