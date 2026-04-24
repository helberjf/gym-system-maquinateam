import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    studentProfile: {
      findUnique: vi.fn(),
    },
  },
  sendWhatsAppTextSafely: vi.fn(async () => ({
    ok: true,
    provider: "z-api" as const,
  })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/messaging/whatsapp", () => ({
  sendWhatsAppTextSafely: mocks.sendWhatsAppTextSafely,
  sendWhatsAppText: vi.fn(),
  normalizeBrazilianPhone: (value: string) =>
    value.replace(/\D/g, "").length >= 10 ? "5511987654321" : null,
}));

import {
  buildClassReminderMessage,
  buildNutritionPlanMessage,
  buildTrainingPlanMessage,
  notifyClassReminder,
  notifyNutritionPlanCreated,
  notifyTrainingPlanCreated,
} from "@/lib/messaging/events";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("message templates", () => {
  it("builds class reminder with student and class info", () => {
    const text = buildClassReminderMessage({
      studentName: "Ana",
      classTitle: "Boxe Avancado",
      modalityName: "Boxe",
      startTime: "19:00",
      endTime: "20:00",
      dayLabel: "quarta",
    });
    expect(text).toContain("Ana");
    expect(text).toContain("Boxe");
    expect(text).toContain("19:00");
    expect(text).toContain("quarta");
  });

  it("builds training plan message", () => {
    const text = buildTrainingPlanMessage({
      studentName: "Joao",
      planTitle: "Hipertrofia 4x",
    });
    expect(text).toContain("Joao");
    expect(text).toContain("Hipertrofia 4x");
  });

  it("builds nutrition plan message", () => {
    const text = buildNutritionPlanMessage({
      studentName: "Carla",
      planTitle: "Dieta cutting",
    });
    expect(text).toContain("Carla");
    expect(text).toContain("Dieta cutting");
  });
});

describe("notifyTrainingPlanCreated", () => {
  it("skips when student has opted out of whatsapp", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: "student-1",
      whatsappOptIn: false,
      user: { name: "Ana", phone: "11987654321" },
    });

    const result = await notifyTrainingPlanCreated({
      studentProfileId: "student-1",
      planTitle: "X",
    });

    expect(result.ok).toBe(false);
    if ("skipped" in result) {
      expect(result.skipped).toBe("opted_out");
    }
    expect(mocks.sendWhatsAppTextSafely).not.toHaveBeenCalled();
  });

  it("skips when student has no phone", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: "student-1",
      whatsappOptIn: true,
      user: { name: "Ana", phone: "" },
    });

    const result = await notifyTrainingPlanCreated({
      studentProfileId: "student-1",
      planTitle: "X",
    });

    expect(result.ok).toBe(false);
    expect(mocks.sendWhatsAppTextSafely).not.toHaveBeenCalled();
  });

  it("sends message when opted in and phone exists", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: "student-1",
      whatsappOptIn: true,
      user: { name: "Ana", phone: "11987654321" },
    });

    await notifyTrainingPlanCreated({
      studentProfileId: "student-1",
      planTitle: "Hipertrofia 4x",
    });

    expect(mocks.sendWhatsAppTextSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "11987654321",
        message: expect.stringContaining("Hipertrofia 4x"),
      }),
    );
  });
});

describe("notifyNutritionPlanCreated", () => {
  it("delegates to sendWhatsAppTextSafely", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: "student-2",
      whatsappOptIn: true,
      user: { name: "Joao", phone: "11987654321" },
    });

    await notifyNutritionPlanCreated({
      studentProfileId: "student-2",
      planTitle: "Cutting 1800",
    });

    expect(mocks.sendWhatsAppTextSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Cutting 1800"),
      }),
    );
  });
});

describe("notifyClassReminder", () => {
  it("builds the class reminder and sends", async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      id: "student-3",
      whatsappOptIn: true,
      user: { name: "Carla", phone: "11987654321" },
    });

    await notifyClassReminder({
      studentProfileId: "student-3",
      classTitle: "Aula mista",
      modalityName: "Funcional",
      startTime: "06:00",
      endTime: "07:00",
      dayLabel: "terca",
    });

    expect(mocks.sendWhatsAppTextSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Funcional"),
      }),
    );
  });
});
