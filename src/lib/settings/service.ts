import type { Prisma } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";
import { BRAND } from "@/lib/constants/brand";
import { logger, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import type { BrandConfigInput } from "@/lib/validators/settings";

export const BRAND_CONFIG_KEY = "brandConfig";

type AuditContext = {
  actorId: string;
  request?: Request;
};

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

type BrandDefaults = typeof BRAND;

export type BrandConfig = {
  name: string;
  slogan: string;
  instructor: string;
  foundedYear: number;
  modalities: readonly string[];
  highlights: readonly string[];
  contact: BrandDefaults["contact"];
  address: BrandDefaults["address"];
  hours: BrandDefaults["hours"];
  reviews: BrandDefaults["reviews"];
  cancellationPolicy: string | null;
};

function deepMerge<T>(base: T, override: DeepPartial<T> | undefined | null): T {
  if (!override || typeof override !== "object") {
    return base;
  }

  if (Array.isArray(base)) {
    return base;
  }

  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const overrideRecord = override as Record<string, unknown>;

  for (const key of Object.keys(overrideRecord)) {
    const overrideValue = overrideRecord[key];
    const baseValue = (base as Record<string, unknown>)[key];

    if (overrideValue === null || overrideValue === undefined) {
      continue;
    }

    if (
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue) &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      baseValue !== null
    ) {
      merged[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      );
    } else {
      merged[key] = overrideValue;
    }
  }

  return merged as T;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return (row?.value as T | undefined) ?? null;
  } catch (error) {
    // Fallback gracefully when the table is missing (e.g., during build before
    // the migration is deployed) or the DB is temporarily unavailable.
    logger.warn("settings.read_failed", {
      key,
      error: serializeError(error),
    });
    return null;
  }
}

export async function setSetting(
  key: string,
  value: Prisma.InputJsonValue,
  audit: AuditContext,
  description?: string,
) {
  const existing = await prisma.appSetting.findUnique({ where: { key } });

  const saved = existing
    ? await prisma.appSetting.update({
        where: { key },
        data: { value, description, updatedById: audit.actorId },
      })
    : await prisma.appSetting.create({
        data: { key, value, description, updatedById: audit.actorId },
      });

  await logAuditEvent({
    actorId: audit.actorId,
    action: existing ? "settings.update" : "settings.create",
    entityType: "AppSetting",
    entityId: saved.id,
    summary: `Configuracao "${key}" ${existing ? "atualizada" : "criada"}.`,
    beforeData: existing?.value as Prisma.InputJsonValue | undefined,
    afterData: value,
    request: audit.request,
  });

  return saved;
}

const defaultBrandConfig: BrandConfig = {
  name: BRAND.name,
  slogan: BRAND.slogan,
  instructor: BRAND.instructor,
  foundedYear: BRAND.foundedYear,
  modalities: BRAND.modalities,
  highlights: BRAND.highlights,
  contact: BRAND.contact,
  address: BRAND.address,
  hours: BRAND.hours,
  reviews: BRAND.reviews,
  cancellationPolicy: null,
};

export async function getBrandConfig(): Promise<BrandConfig> {
  const override = await getSetting<DeepPartial<BrandConfig>>(BRAND_CONFIG_KEY);
  if (!override) return defaultBrandConfig;
  return deepMerge(defaultBrandConfig, override);
}

export async function getBrandConfigOverride(): Promise<DeepPartial<BrandConfig> | null> {
  return getSetting<DeepPartial<BrandConfig>>(BRAND_CONFIG_KEY);
}

export async function updateBrandConfig(
  input: BrandConfigInput,
  audit: AuditContext,
) {
  const sanitized: Prisma.InputJsonValue = JSON.parse(JSON.stringify(input));
  await setSetting(
    BRAND_CONFIG_KEY,
    sanitized,
    audit,
    "Marca, contato, horario e politicas exibidos no site publico.",
  );
  return getBrandConfig();
}

export const BRAND_DEFAULTS = defaultBrandConfig;
