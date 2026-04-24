import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    classSchedule: {
      findMany: vi.fn(),
    },
  },
  notifyClassReminder: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/messaging/events", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/messaging/events")
  >("@/lib/messaging/events");
  return {
    ...actual,
    notifyClassReminder: mocks.notifyClassReminder,
  };
});

import { sendDailyClassReminders } from "@/lib/messaging/class-reminders";

const now = new Date("2026-04-22T12:00:00Z");
const tomorrow = new Date("2026-04-23T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendDailyClassReminders", () => {
  it("matches schedules running on target weekday and notifies enrollments", async () => {
    mocks.prisma.classSchedule.findMany.mockResolvedValue([
      {
        id: "sc-1",
        title: "Boxe",
        dayOfWeek: tomorrow.getUTCDay(),
        daysOfWeek: [],
        startTime: "19:00",
        endTime: "20:00",
        isActive: true,
        validFrom: null,
        validUntil: null,
        modality: { name: "Boxe" },
        enrollments: [
          { studentProfileId: "s1", startsAt: null, endsAt: null },
          { studentProfileId: "s2", startsAt: null, endsAt: null },
        ],
      },
      {
        id: "sc-2",
        title: "Muay Thai",
        dayOfWeek: (tomorrow.getUTCDay() + 3) % 7,
        daysOfWeek: [],
        startTime: "18:00",
        endTime: "19:00",
        isActive: true,
        validFrom: null,
        validUntil: null,
        modality: { name: "Muay Thai" },
        enrollments: [
          { studentProfileId: "s3", startsAt: null, endsAt: null },
        ],
      },
    ]);

    const result = await sendDailyClassReminders(now);

    expect(mocks.notifyClassReminder).toHaveBeenCalledTimes(2);
    expect(result.scheduled).toBe(2);
    expect(result.sent).toBe(2);
  });

  it("respects enrollment startsAt/endsAt windows", async () => {
    mocks.prisma.classSchedule.findMany.mockResolvedValue([
      {
        id: "sc-1",
        title: "Aula",
        dayOfWeek: tomorrow.getUTCDay(),
        daysOfWeek: [],
        startTime: "19:00",
        endTime: "20:00",
        isActive: true,
        validFrom: null,
        validUntil: null,
        modality: { name: "Funcional" },
        enrollments: [
          {
            studentProfileId: "s1",
            startsAt: new Date("2026-05-01T00:00:00Z"),
            endsAt: null,
          },
          {
            studentProfileId: "s2",
            startsAt: null,
            endsAt: new Date("2026-04-10T00:00:00Z"),
          },
          {
            studentProfileId: "s3",
            startsAt: null,
            endsAt: null,
          },
        ],
      },
    ]);

    const result = await sendDailyClassReminders(now);

    expect(mocks.notifyClassReminder).toHaveBeenCalledTimes(1);
    expect(result.scheduled).toBe(1);
  });

  it("reports errors without crashing the loop", async () => {
    mocks.prisma.classSchedule.findMany.mockResolvedValue([
      {
        id: "sc-1",
        title: "Aula",
        dayOfWeek: tomorrow.getUTCDay(),
        daysOfWeek: [],
        startTime: "19:00",
        endTime: "20:00",
        isActive: true,
        validFrom: null,
        validUntil: null,
        modality: { name: "Funcional" },
        enrollments: [
          { studentProfileId: "s1", startsAt: null, endsAt: null },
          { studentProfileId: "s2", startsAt: null, endsAt: null },
        ],
      },
    ]);
    mocks.notifyClassReminder
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true });

    const result = await sendDailyClassReminders(now);

    expect(result.scheduled).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(1);
  });
});
