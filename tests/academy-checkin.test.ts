import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

const mocks = vi.hoisted(() => {
  const tx = {
    classEnrollment: {
      findFirst: vi.fn(),
    },
    attendance: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(),
      subscription: {
        findFirst: vi.fn(),
      },
      payment: {
        findFirst: vi.fn(),
      },
    },
    ensureVisibleStudent: vi.fn(),
    ensureVisibleClassSchedule: vi.fn(),
    logAuditEvent: vi.fn(),
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/academy/access", () => ({
  ensureVisibleStudent: mocks.ensureVisibleStudent,
  ensureVisibleClassSchedule: mocks.ensureVisibleClassSchedule,
  getAttendanceVisibilityWhere: vi.fn(() => ({})),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/academy/gamification", () => ({
  awardPointsSafely: vi.fn(async () => undefined),
  POINTS_PER_CHECKIN: 10,
}));

import { checkInStudent } from "@/lib/academy/service";

describe("attendance smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) =>
        callback(mocks.tx),
    );
    mocks.ensureVisibleStudent.mockResolvedValue({ id: "student-1" });
    mocks.ensureVisibleClassSchedule.mockResolvedValue({ id: "class-1" });
    mocks.tx.classEnrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.prisma.subscription.findFirst.mockResolvedValue({
      id: "sub-1",
      status: "ACTIVE",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mocks.prisma.payment.findFirst.mockResolvedValue(null);
  });

  it("blocks duplicate open check-ins for the same student and class day", async () => {
    mocks.tx.attendance.findUnique.mockResolvedValue({
      id: "attendance-1",
      status: AttendanceStatus.CHECKED_IN,
      checkedOutAt: null,
    });

    await expect(
      checkInStudent(
        {
          studentProfileId: "student-1",
          classScheduleId: "class-1",
          classDate: "2026-03-31",
          notes: "Chegou cedo",
          overrideFinancial: false,
        },
        {
          viewer: {
            userId: "staff-1",
            role: UserRole.RECEPCAO,
            studentProfileId: null,
            teacherProfileId: null,
          },
          request: new Request("http://localhost/api/attendance/check-in"),
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
