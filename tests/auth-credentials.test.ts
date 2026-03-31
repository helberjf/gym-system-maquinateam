import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooManyRequestsError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
  verifyPassword: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");

  return {
    ...actual,
    enforceRateLimit: mocks.enforceRateLimit,
  };
});

import {
  authorizeCredentials,
  EmailNotVerifiedError,
  RateLimitedCredentialsError,
} from "@/lib/auth/credentials";

describe("credentials auth smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("allows login with verified email and correct password", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "ALUNO",
      isActive: true,
      passwordHash: "hash",
      emailVerified: new Date(),
      accounts: [],
    });

    const result = await authorizeCredentials(
      {
        email: "alice@example.com",
        password: "Senha@123",
      },
      new Request("http://localhost/login"),
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "alice@example.com",
      }),
    );
    expect(mocks.verifyPassword).toHaveBeenCalledWith("Senha@123", "hash");
  });

  it("blocks credentials login when email is not verified", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "ALUNO",
      isActive: true,
      passwordHash: "hash",
      emailVerified: null,
      accounts: [],
    });

    await expect(
      authorizeCredentials(
        {
          email: "alice@example.com",
          password: "Senha@123",
        },
        new Request("http://localhost/login"),
      ),
    ).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });

  it("maps login rate limit errors to credentials-specific failure", async () => {
    mocks.enforceRateLimit.mockRejectedValue(
      new TooManyRequestsError("Muitas tentativas."),
    );

    await expect(
      authorizeCredentials(
        {
          email: "alice@example.com",
          password: "Senha@123",
        },
        new Request("http://localhost/login"),
      ),
    ).rejects.toBeInstanceOf(RateLimitedCredentialsError);
  });
});
