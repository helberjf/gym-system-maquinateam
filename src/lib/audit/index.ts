import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger, serializeError } from "@/lib/observability/logger";

const SENSITIVE_FIELDS = new Set([
  "password",
  "confirmPassword",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "id_token",
  "authorization",
  "cookie",
]);

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  actorId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  request?: Request | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getClientIpFromRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

function redactSensitiveValues(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[truncated]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_FIELDS.has(key)
          ? "[redacted]"
          : redactSensitiveValues(nested, depth + 1),
      ]),
    );
  }

  return String(value);
}

function toJsonValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return redactSensitiveValues(value) as Prisma.InputJsonValue;
}

export async function logAuditEvent(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        beforeData: toJsonValue(input.beforeData),
        afterData: toJsonValue(input.afterData),
        ipAddress:
          input.ipAddress ??
          (input.request ? getClientIpFromRequest(input.request) : null),
        userAgent:
          input.userAgent ??
          input.request?.headers.get("user-agent") ??
          null,
      },
    });
  } catch (error) {
    logger.error("audit.log_failed", { error: serializeError(error) });
  }
}
