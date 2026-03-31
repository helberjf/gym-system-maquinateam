import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentStatus } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      create: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      verificationToken: {
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
      },
      passwordResetToken: {
        deleteMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    tx,
    hashPassword: vi.fn(),
    generateSecureToken: vi.fn(),
    hashToken: vi.fn(),
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    logAuditEvent: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/auth/tokens", () => ({
  generateSecureToken: mocks.generateSecureToken,
  hashToken: mocks.hashToken,
}));

vi.mock("@/lib/mail", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

import {
  consumeVerificationToken,
  registerStudent,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth/service";

describe("auth service smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(mocks.tx);
      }

      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input;
    });

    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.generateSecureToken.mockReturnValue("raw-token");
    mocks.hashToken.mockImplementation((value: string) => `hashed:${value}`);
    mocks.sendVerificationEmail.mockResolvedValue(undefined);
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
    mocks.logAuditEvent.mockResolvedValue(undefined);

    mocks.tx.user.create.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
    });
    mocks.tx.studentProfile.create.mockResolvedValue({ id: "student-1" });
    mocks.tx.studentProfile.update.mockResolvedValue({ id: "student-1" });
    mocks.tx.user.update.mockResolvedValue({ id: "user-1" });
    mocks.tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.tx.verificationToken.create.mockResolvedValue({ id: "verification-1" });

    mocks.prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.passwordResetToken.create.mockResolvedValue({ id: "reset-1" });
    mocks.prisma.passwordResetToken.update.mockResolvedValue({ id: "reset-1" });
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.user.update.mockResolvedValue({ id: "user-1" });
    mocks.prisma.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("creates a pending student account and sends verification email on register", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const result = await registerStudent({
      name: "Alice",
      email: "alice@example.com",
      password: "Senha@123",
      confirmPassword: "Senha@123",
    });

    expect(result.ok).toBe(true);
    expect(result.email).toBe("alice@example.com");
    expect(result.emailSent).toBe(true);
    expect(mocks.tx.user.create).toHaveBeenCalled();
    expect(mocks.tx.studentProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StudentStatus.PENDING,
        }),
      }),
    );
    expect(mocks.tx.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: "hashed:raw-token",
        }),
      }),
    );
    expect(mocks.sendVerificationEmail).toHaveBeenCalled();
  });

  it("confirms email with a valid one-time token", async () => {
    mocks.prisma.verificationToken.findFirst.mockResolvedValue({
      id: "verification-1",
      identifier: "alice@example.com",
      token: "hashed:verification",
      expires: new Date(Date.now() + 60_000),
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      studentProfile: {
        id: "student-1",
        status: StudentStatus.PENDING,
      },
    });

    const result = await consumeVerificationToken("verification");

    expect(result.ok).toBe(true);
    expect(result.email).toBe("alice@example.com");
    expect(mocks.tx.user.update).toHaveBeenCalled();
    expect(mocks.tx.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StudentStatus.ACTIVE,
        }),
      }),
    );
    expect(mocks.tx.verificationToken.deleteMany).toHaveBeenCalled();
  });

  it("creates a password reset token for a valid account", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: new Date(),
      passwordHash: "old-hash",
      isActive: true,
    });

    const result = await requestPasswordReset({
      email: "alice@example.com",
    });

    expect(result.ok).toBe(true);
    expect(mocks.prisma.passwordResetToken.deleteMany).toHaveBeenCalled();
    expect(mocks.prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: "hashed:raw-token",
        }),
      }),
    );
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it("resets password with a valid token and revokes sessions", async () => {
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: "reset-1",
      token: "hashed:reset",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user-1",
        passwordHash: "old-hash",
      },
    });

    const result = await resetPasswordWithToken({
      token: "reset",
      password: "NovaSenha@123",
      confirmPassword: "NovaSenha@123",
    });

    expect(result.ok).toBe(true);
    expect(mocks.hashPassword).toHaveBeenCalledWith("NovaSenha@123");
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "hashed-password",
        }),
      }),
    );
    expect(mocks.prisma.passwordResetToken.update).toHaveBeenCalled();
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalled();
  });
});
