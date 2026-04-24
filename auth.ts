import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { StudentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTH_ERROR_CODES } from "@/lib/auth/error-codes";
import {
  AccountDisabledError,
  authorizeCredentials,
  EmailNotVerifiedError,
  GoogleAccountOnlyError,
  InvalidCredentialsError,
  RateLimitedCredentialsError,
} from "@/lib/auth/credentials";

type SessionUserShape = {
  id?: string;
  role?: UserRole;
  emailVerified?: Date | string | null;
  isActive?: boolean;
};

function getAuthErrorType(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { type?: unknown; name?: unknown };

  if (typeof candidate.type === "string") {
    return candidate.type;
  }

  if (typeof candidate.name === "string") {
    return candidate.name;
  }

  return null;
}

function writeAuthLog(error: unknown) {
  if (!(error instanceof Error)) {
    process.stderr.write(`[auth][error] ${String(error)}\n`);
    return;
  }

  const authErrorType = getAuthErrorType(error) ?? error.name;
  const details = [`[auth][error] ${authErrorType}: ${error.message}`];

  if (error.stack) {
    details.push(error.stack);
  }

  process.stderr.write(`${details.join("\n")}\n`);
}

function buildStudentRegistrationNumber(userId: string) {
  return `ALU-${userId.slice(-8).toUpperCase()}`;
}

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const providers: NextAuthConfig["providers"] = [
  ...(googleEnabled
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials, request) {
      return authorizeCredentials(credentials, request);
    },
  }),
];

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  logger: {
    error(error) {
      const authErrorType = getAuthErrorType(error);

      if (
        authErrorType === "JWTSessionError" ||
        authErrorType === "SessionTokenError" ||
        error instanceof InvalidCredentialsError ||
        error instanceof EmailNotVerifiedError ||
        error instanceof AccountDisabledError ||
        error instanceof GoogleAccountOnlyError ||
        error instanceof RateLimitedCredentialsError ||
        (error instanceof Error && error.name === "CredentialsSignin")
      ) {
        return;
      }

      writeAuthLog(error);
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      const normalizedEmail = user.email.toLowerCase();
      const dbUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          role: true,
          isActive: true,
          emailVerified: true,
          passwordHash: true,
          accounts: {
            where: { provider: "google" },
            select: { id: true },
          },
        },
      });

      if (dbUser && !dbUser.isActive) {
        return `/login?error=${AUTH_ERROR_CODES.accountDisabled}`;
      }

      if (account?.provider === "google" && dbUser) {
        const hasGoogleLink = dbUser.accounts.length > 0;

        if (!hasGoogleLink && (dbUser.passwordHash || !dbUser.emailVerified)) {
          return `/login?error=${AUTH_ERROR_CODES.accountDisabled}`;
        }
      }

      if (dbUser) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            lastLoginAt: new Date(),
          },
        });
      }

      if (account?.provider === "google") {
        (user as SessionUserShape).role = dbUser?.role ?? UserRole.ALUNO;
      }

      if (dbUser) {
        (user as SessionUserShape).id = dbUser.id;
        (user as SessionUserShape).role = dbUser.role;
        (user as SessionUserShape).emailVerified = dbUser.emailVerified;
        (user as SessionUserShape).isActive = dbUser.isActive;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as SessionUserShape).role ?? UserRole.ALUNO;
        const emailVerified = (user as SessionUserShape).emailVerified;
        token.emailVerified =
          emailVerified instanceof Date
            ? emailVerified.toISOString()
            : emailVerified ?? null;
        token.isActive = (user as SessionUserShape).isActive ?? true;
        return token;
      }

      if (
        token.role !== undefined &&
        token.emailVerified !== undefined &&
        token.isActive !== undefined
      ) {
        return token;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            emailVerified: true,
            isActive: true,
          },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;
          token.isActive = dbUser.isActive;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.ALUNO;
        session.user.emailVerified =
          typeof token.emailVerified === "string"
            ? new Date(token.emailVerified)
            : null;
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const userId = user.id;

      if (!userId) {
        return;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            role: UserRole.ALUNO,
            isActive: true,
          },
        }),
        prisma.studentProfile.upsert({
          where: {
            userId,
          },
          update: {},
          create: {
            userId,
            registrationNumber: buildStudentRegistrationNumber(userId),
            status: user.emailVerified
              ? StudentStatus.ACTIVE
              : StudentStatus.PENDING,
            joinedAt: new Date(),
          },
        }),
      ]);
    },
    async linkAccount({ user, account }) {
      const userId = user.id;

      if (!userId) {
        return;
      }

      if (account.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            emailVerified: true,
          },
        });

        if (!dbUser) {
          return;
        }

        if (dbUser.role === UserRole.ALUNO) {
          await prisma.studentProfile.upsert({
            where: {
              userId,
            },
            update: {
              status: dbUser.emailVerified
                ? StudentStatus.ACTIVE
                : StudentStatus.PENDING,
            },
            create: {
              userId,
              registrationNumber: buildStudentRegistrationNumber(userId),
              status: dbUser.emailVerified
                ? StudentStatus.ACTIVE
                : StudentStatus.PENDING,
              joinedAt: new Date(),
            },
          });
        }
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
