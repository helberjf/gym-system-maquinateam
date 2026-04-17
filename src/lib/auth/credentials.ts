import { CredentialsSignin } from "next-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTH_ERROR_CODES } from "@/lib/auth/error-codes";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validators/auth";
import crypto from "crypto";
import { TooManyRequestsError } from "@/lib/errors";
import { enforceRateLimit, loginEmailLimiter, loginLimiter } from "@/lib/rate-limit";

export class InvalidCredentialsError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.invalidCredentials;
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.emailNotVerified;
}

export class AccountDisabledError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.accountDisabled;
}

export class GoogleAccountOnlyError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.googleAccountOnly;
}

export class RateLimitedCredentialsError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.rateLimited;
}

export async function authorizeCredentials(
  credentials: unknown,
  request: Request,
) {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    throw new InvalidCredentialsError();
  }

  const email = parsed.data.email.toLowerCase();
  const emailIdentifier = crypto
    .createHash("sha256")
    .update(`login-email|${email}`)
    .digest("hex");

  try {
    await enforceRateLimit({
      request,
      limiter: loginLimiter,
      keyParts: [email],
    });

    await enforceRateLimit({
      request,
      limiter: loginEmailLimiter,
      identifier: emailIdentifier,
    });
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw new RateLimitedCredentialsError();
    }

    throw error;
  }
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        where: { provider: "google" },
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  if (!user.isActive) {
    throw new AccountDisabledError();
  }

  if (!user.passwordHash) {
    if (user.accounts.length > 0) {
      throw new GoogleAccountOnlyError();
    }

    throw new InvalidCredentialsError();
  }

  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  if (!user.emailVerified) {
    throw new EmailNotVerifiedError();
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? UserRole.ALUNO,
    emailVerified: user.emailVerified,
  };
}
