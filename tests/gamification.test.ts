import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeRequirementType, GamificationAction, UserRole } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

const mocks = vi.hoisted(() => {
  const tx = {
    studentGamification: { update: vi.fn(), upsert: vi.fn() },
    gamificationEvent: { create: vi.fn() },
  };

  return {
    prisma: {
      $transaction: vi.fn(),
      studentGamification: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      gamificationEvent: {
        findMany: vi.fn(),
      },
      gamificationBadge: {
        findMany: vi.fn(),
      },
      studentBadge: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    },
    ensureVisibleStudent: vi.fn(),
    captureException: vi.fn(),
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/academy/access", () => ({
  ensureVisibleStudent: mocks.ensureVisibleStudent,
}));

vi.mock("@/lib/observability/capture", () => ({
  captureException: mocks.captureException,
}));

import {
  awardPoints,
  calculateLevel,
  evaluateBadgeUnlocks,
  getStudentGamification,
} from "@/lib/academy/gamification";

const adminViewer = {
  userId: "user-admin",
  role: UserRole.ADMIN,
  teacherProfileId: null,
  studentProfileId: null,
} as const;

const studentViewer = {
  userId: "user-student",
  role: UserRole.ALUNO,
  teacherProfileId: null,
  studentProfileId: "student-1",
} as const;

const otherStudentViewer = {
  userId: "user-other",
  role: UserRole.ALUNO,
  teacherProfileId: null,
  studentProfileId: "student-2",
} as const;

describe("calculateLevel", () => {
  it("returns level 1 at zero points", () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.progressPercent).toBe(0);
  });

  it("computes progress between thresholds", () => {
    const result = calculateLevel(200);
    expect(result.level).toBe(2);
    expect(result.pointsIntoLevel).toBe(100);
    expect(result.pointsForNextLevel).toBe(200);
    expect(result.progressPercent).toBe(50);
  });

  it("caps progress at the final threshold", () => {
    const result = calculateLevel(999999);
    expect(result.pointsForNextLevel).toBeNull();
    expect(result.progressPercent).toBe(100);
  });
});

describe("awardPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) =>
        callback(mocks.tx),
    );
    mocks.prisma.gamificationBadge.findMany.mockResolvedValue([]);
    mocks.prisma.studentBadge.findMany.mockResolvedValue([]);
    mocks.prisma.studentGamification.findUnique.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 0,
      checkinCount: 0,
      assessmentCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    });
  });

  it("starts streak at 1 on first check-in", async () => {
    mocks.tx.studentGamification.upsert.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 0,
      checkinCount: 0,
      assessmentCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    });

    await awardPoints({
      studentId: "student-1",
      action: GamificationAction.CHECKIN,
      basePoints: 10,
    });

    expect(mocks.tx.studentGamification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStreak: 1,
          longestStreak: 1,
          totalPoints: { increment: 10 },
          checkinCount: { increment: 1 },
        }),
      }),
    );
    expect(mocks.tx.gamificationEvent.create).toHaveBeenCalledTimes(1);
  });

  it("adds streak bonus on 3 consecutive days", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    mocks.tx.studentGamification.upsert.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 40,
      checkinCount: 2,
      assessmentCount: 0,
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: yesterday,
    });

    await awardPoints({
      studentId: "student-1",
      action: GamificationAction.CHECKIN,
      basePoints: 10,
    });

    expect(mocks.tx.studentGamification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStreak: 3,
          totalPoints: { increment: 15 },
        }),
      }),
    );
    expect(mocks.tx.gamificationEvent.create).toHaveBeenCalledTimes(2);
  });

  it("resets streak when gap is bigger than one day", async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    mocks.tx.studentGamification.upsert.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 40,
      checkinCount: 2,
      assessmentCount: 0,
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: threeDaysAgo,
    });

    await awardPoints({
      studentId: "student-1",
      action: GamificationAction.CHECKIN,
      basePoints: 10,
    });

    expect(mocks.tx.studentGamification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStreak: 2,
          longestStreak: 2,
        }),
      }),
    );
  });
});

describe("evaluateBadgeUnlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awards badges when thresholds are met", async () => {
    mocks.prisma.studentGamification.findUnique.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 150,
      checkinCount: 5,
      assessmentCount: 1,
      currentStreak: 3,
      longestStreak: 3,
      lastActivityDate: new Date(),
    });
    mocks.prisma.gamificationBadge.findMany.mockResolvedValue([
      {
        id: "badge-streak-3",
        code: "STREAK_3",
        name: "Ritmo inicial",
        requirementType: BadgeRequirementType.CURRENT_STREAK,
        threshold: 3,
      },
      {
        id: "badge-points-500",
        code: "POINTS_500",
        name: "Meio caminho",
        requirementType: BadgeRequirementType.TOTAL_POINTS,
        threshold: 500,
      },
    ]);
    mocks.prisma.studentBadge.findMany.mockResolvedValue([]);

    const awarded = await evaluateBadgeUnlocks("student-1");

    expect(awarded).toHaveLength(1);
    expect(awarded[0].code).toBe("STREAK_3");
    expect(mocks.prisma.studentBadge.create).toHaveBeenCalledTimes(1);
  });

  it("skips badges already earned", async () => {
    mocks.prisma.studentGamification.findUnique.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 10,
      checkinCount: 1,
      assessmentCount: 0,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
    });
    mocks.prisma.gamificationBadge.findMany.mockResolvedValue([
      {
        id: "badge-first",
        code: "FIRST_CHECKIN",
        name: "Primeira aula",
        requirementType: BadgeRequirementType.CHECKIN_COUNT,
        threshold: 1,
      },
    ]);
    mocks.prisma.studentBadge.findMany.mockResolvedValue([
      { badgeId: "badge-first" },
    ]);

    const awarded = await evaluateBadgeUnlocks("student-1");

    expect(awarded).toHaveLength(0);
    expect(mocks.prisma.studentBadge.create).not.toHaveBeenCalled();
  });
});

describe("getStudentGamification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureVisibleStudent.mockResolvedValue({ id: "student-1" });
    mocks.prisma.studentGamification.upsert.mockResolvedValue({
      studentId: "student-1",
      totalPoints: 0,
      checkinCount: 0,
      assessmentCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    });
    mocks.prisma.studentBadge.findMany.mockResolvedValue([]);
    mocks.prisma.gamificationEvent.findMany.mockResolvedValue([]);
  });

  it("returns gamification data for admin viewer", async () => {
    const result = await getStudentGamification("student-1", adminViewer);
    expect(result.level.level).toBe(1);
    expect(result.earnedBadges).toEqual([]);
  });

  it("lets ALUNO access only their own profile", async () => {
    await expect(
      getStudentGamification("student-1", otherStudentViewer),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      getStudentGamification("student-1", studentViewer),
    ).resolves.toBeDefined();
  });
});
