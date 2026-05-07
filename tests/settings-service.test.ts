import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    appSetting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: mocks.logAuditEvent }));

import {
  BRAND_CONFIG_KEY,
  BRAND_DEFAULTS,
  getBrandConfig,
  setSetting,
  updateBrandConfig,
} from "@/lib/settings/service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBrandConfig", () => {
  it("returns defaults when no override exists", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValue(null);
    const config = await getBrandConfig();
    expect(config.name).toBe(BRAND_DEFAULTS.name);
    expect(config.contact.phone).toBe(BRAND_DEFAULTS.contact.phone);
  });

  it("merges override on top of defaults preserving untouched fields", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValue({
      value: {
        name: "Maquina Team Premium",
        contact: { phone: "(11) 99999-0000" },
      },
    });

    const config = await getBrandConfig();

    expect(config.name).toBe("Maquina Team Premium");
    expect(config.contact.phone).toBe("(11) 99999-0000");
    // Untouched fields fall back to default
    expect(config.contact.email).toBe(BRAND_DEFAULTS.contact.email);
    expect(config.slogan).toBe(BRAND_DEFAULTS.slogan);
  });

  it("array fields in override replace defaults (not concat)", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValue({
      value: {
        modalities: ["Yoga"],
      },
    });

    const config = await getBrandConfig();

    // Override REPLACES arrays — desired semantic to allow admin to remove an item
    expect(Array.isArray(config.modalities)).toBe(true);
    expect(config.modalities).toEqual(["Yoga"]);
    // Other arrays untouched fall back to defaults
    expect(config.highlights).toEqual(BRAND_DEFAULTS.highlights);
  });
});

describe("setSetting", () => {
  it("creates row when key does not exist", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValue(null);
    mocks.prisma.appSetting.create.mockResolvedValue({ id: "s-1" });

    await setSetting(
      "feature.flag",
      { enabled: true },
      { actorId: "u-1" },
    );

    expect(mocks.prisma.appSetting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "feature.flag",
          value: { enabled: true },
          updatedById: "u-1",
        }),
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.create" }),
    );
  });

  it("updates row when key exists", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValue({
      id: "s-1",
      value: { enabled: false },
    });
    mocks.prisma.appSetting.update.mockResolvedValue({ id: "s-1" });

    await setSetting(
      "feature.flag",
      { enabled: true },
      { actorId: "u-1" },
    );

    expect(mocks.prisma.appSetting.update).toHaveBeenCalled();
    expect(mocks.prisma.appSetting.create).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.update" }),
    );
  });
});

describe("updateBrandConfig", () => {
  it("persists payload under brandConfig key and returns merged config", async () => {
    mocks.prisma.appSetting.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.appSetting.create.mockResolvedValue({ id: "s-1" });
    mocks.prisma.appSetting.findUnique.mockResolvedValueOnce({
      value: { name: "X", contact: { phone: "(00) 0000-0000" } },
    });

    const config = await updateBrandConfig(
      { name: "X", contact: { phone: "(00) 0000-0000" } },
      { actorId: "u-1" },
    );

    expect(mocks.prisma.appSetting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: BRAND_CONFIG_KEY }),
      }),
    );
    expect(config.name).toBe("X");
    expect(config.contact.phone).toBe("(00) 0000-0000");
  });
});
