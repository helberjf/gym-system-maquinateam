import { StudentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForgotPasswordInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
} from "@/lib/auth/validation";
import { logAuditEvent } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { generateSecureToken, hashToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function getAppUrl() {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildStudentRegistrationNumber(userId: string) {
  return `ALU-${userId.slice(-8).toUpperCase()}`;
}

function buildVerificationUrl(token: string) {
  return `${getAppUrl()}/confirmar-email?token=${token}`;
}

function buildPasswordResetUrl(token: string) {
  return `${getAppUrl()}/redefinir-senha/${token}`;
}

type VerificationRequestResult = {
  ok: true;
  message: string;
};

type ServiceAuditContext = {
  request?: Request | null;
  actorId?: string | null;
};

export async function registerStudent(
  input: RegisterInput,
  auditContext?: ServiceAuditContext,
) {
  const email = normalizeEmail(input.email);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return {
      ok: false as const,
      status: 409,
      message: "Ja existe uma conta com esse e-mail.",
    };
  }

  const passwordHash = await hashPassword(input.password);
  const rawToken = generateSecureToken();
  const verificationTokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: "ALUNO",
        isActive: true,
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: createdUser.id,
        registrationNumber: buildStudentRegistrationNumber(createdUser.id),
        status: StudentStatus.PENDING,
        joinedAt: new Date(),
      },
    });

    await tx.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    });

    await tx.verificationToken.create({
      data: {
        identifier: email,
        token: verificationTokenHash,
        expires: expiresAt,
      },
    });

    return createdUser;
  });

  let emailSent = true;

  try {
    await sendVerificationEmail({
      email,
      name: user.name,
      verificationUrl: buildVerificationUrl(rawToken),
    });
  } catch (error) {
    emailSent = false;
    console.error("verification email error:", error);
  }

  await logAuditEvent({
    action: "AUTH_REGISTERED",
    entityType: "User",
    entityId: user.id,
    summary: "Novo cadastro com credentials criado.",
    actorId: auditContext?.actorId ?? null,
    request: auditContext?.request,
    afterData: {
      email,
      role: "ALUNO",
      emailSent,
    },
  });

  return {
    ok: true as const,
    status: 201,
    userId: user.id,
    email,
    emailSent,
    message: emailSent
      ? "Conta criada. Enviamos um e-mail de confirmacao."
      : "Conta criada, mas nao foi possivel enviar o e-mail agora. Use o reenvio de confirmacao.",
  };
}

export async function consumeVerificationToken(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.verificationToken.findFirst({
    where: {
      token: tokenHash,
      expires: {
        gt: new Date(),
      },
    },
  });

  if (!record) {
    return {
      ok: false as const,
      message: "Token invalido ou expirado.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: {
      id: true,
      email: true,
      studentProfile: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: record.identifier,
      },
    });

    return {
      ok: false as const,
      message: "Conta nao encontrada para este token.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    });

    if (user.studentProfile?.status === StudentStatus.PENDING) {
      await tx.studentProfile.update({
        where: { id: user.studentProfile.id },
        data: {
          status: StudentStatus.ACTIVE,
        },
      });
    }

    await tx.verificationToken.deleteMany({
      where: {
        identifier: record.identifier,
      },
    });
  });

  await logAuditEvent({
    action: "AUTH_EMAIL_VERIFIED",
    entityType: "User",
    entityId: user.id,
    summary: "Conta confirmada por token de verificacao.",
    afterData: {
      email: user.email,
      studentProfileStatus:
        user.studentProfile?.status === StudentStatus.PENDING
          ? StudentStatus.ACTIVE
          : user.studentProfile?.status ?? null,
    },
  });

  return {
    ok: true as const,
    email: user.email,
    message: "E-mail confirmado com sucesso.",
  };
}

export async function resendVerificationEmail(
  input: ResendVerificationInput,
  auditContext?: ServiceAuditContext,
): Promise<VerificationRequestResult> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      emailVerified: true,
      isActive: true,
    },
  });

  if (!user || user.emailVerified || !user.isActive) {
    return {
      ok: true,
      message: "Se existir uma conta pendente, enviaremos um novo e-mail de confirmacao.",
    };
  }

  const rawToken = generateSecureToken();
  const verificationTokenHash = hashToken(rawToken);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    }),
    prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationTokenHash,
        expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    }),
  ]);

  let emailSent = true;

  try {
    await sendVerificationEmail({
      email,
      name: user.name,
      verificationUrl: buildVerificationUrl(rawToken),
    });
  } catch (error) {
    emailSent = false;
    console.error("resend verification email error:", error);
  }

  await logAuditEvent({
    action: "AUTH_VERIFICATION_RESENT",
    entityType: "User",
    entityId: user.id,
    summary: "Novo e-mail de confirmacao solicitado.",
    actorId: auditContext?.actorId ?? null,
    request: auditContext?.request,
    afterData: {
      email,
      emailSent,
    },
  });

  return {
    ok: true,
    message: "Se existir uma conta pendente, enviaremos um novo e-mail de confirmacao.",
  };
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
  auditContext?: ServiceAuditContext,
): Promise<VerificationRequestResult> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.passwordHash || !user.emailVerified || !user.isActive) {
    return {
      ok: true,
      message: "Se existir uma conta valida, enviaremos um e-mail para redefinir sua senha.",
    };
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  let emailSent = true;

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl: buildPasswordResetUrl(rawToken),
    });
  } catch (error) {
    emailSent = false;
    console.error("password reset email error:", error);
  }

  await logAuditEvent({
    action: "AUTH_PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
    summary: "Solicitacao valida de redefinicao de senha.",
    actorId: auditContext?.actorId ?? null,
    request: auditContext?.request,
    afterData: {
      email: user.email,
      emailSent,
    },
  });

  return {
    ok: true,
    message: "Se existir uma conta valida, enviaremos um e-mail para redefinir sua senha.",
  };
}

export async function getPasswordResetTokenStatus(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token: tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!record) {
    return {
      ok: false as const,
      message: "Link invalido ou expirado.",
    };
  }

  return {
    ok: true as const,
    email: record.user.email,
  };
}

export async function resetPasswordWithToken(
  input: ResetPasswordInput,
  auditContext?: ServiceAuditContext,
) {
  const tokenHash = hashToken(input.token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token: tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          passwordHash: true,
        },
      },
    },
  });

  if (!record || !record.user.passwordHash) {
    return {
      ok: false as const,
      status: 400,
      message: "Link invalido ou expirado.",
    };
  }

  const newPasswordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash: newPasswordHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.user.id,
        id: {
          not: record.id,
        },
      },
    }),
    prisma.session.deleteMany({
      where: {
        userId: record.user.id,
      },
    }),
  ]);

  await logAuditEvent({
    action: "AUTH_PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: record.user.id,
    summary: "Senha redefinida com token de uso unico.",
    actorId: auditContext?.actorId ?? null,
    request: auditContext?.request,
    afterData: {
      sessionRevoked: true,
    },
  });

  return {
    ok: true as const,
    status: 200,
    message: "Senha redefinida com sucesso.",
  };
}
