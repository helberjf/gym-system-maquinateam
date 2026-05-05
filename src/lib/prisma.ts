import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
  prismaDatasourceUrl?: string | null;
};

function getDevelopmentDatabaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);

    if (
      url.searchParams.get("pgbouncer") === "true" &&
      url.searchParams.get("connection_limit") === "1"
    ) {
      url.searchParams.set("connection_limit", "5");
      url.searchParams.set(
        "pool_timeout",
        url.searchParams.get("pool_timeout") ?? "20",
      );
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const developmentDatabaseUrl = getDevelopmentDatabaseUrl();
const prismaDatasourceUrl =
  developmentDatabaseUrl ?? process.env.DATABASE_URL ?? null;
const shouldReusePrisma =
  globalForPrisma.prisma &&
  globalForPrisma.prismaDatasourceUrl === prismaDatasourceUrl;

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  !shouldReusePrisma
) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
}

export const prisma = shouldReusePrisma
  ? globalForPrisma.prisma!
  : new PrismaClient({
    ...(developmentDatabaseUrl
      ? {
          datasourceUrl: developmentDatabaseUrl,
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatasourceUrl = prismaDatasourceUrl;
}
