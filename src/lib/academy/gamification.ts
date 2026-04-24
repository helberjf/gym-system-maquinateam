import type { Prisma } from "@prisma/client";
import {
  BadgeRequirementType,
  GamificationAction,
  Prisma as PrismaRuntime,
  UserRole,
} from "@prisma/client";
import { ensureVisibleStudent, type ViewerContext } from "@/lib/academy/access";
import { ForbiddenError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/observability/capture";

export const POINTS_PER_CHECKIN = 10;
export const POINTS_PER_ASSESSMENT = 30;
export const STREAK_BONUS_POINTS = 5;
export const STREAK_BONUS_EVERY_N_DAYS = 3;

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

export type GamificationLevel = {
  level: number;
  currentPoints: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number | null;
  progressPercent: number;
};

export function calculateLevel(totalPoints: number): GamificationLevel {
  let level = 1;
  let floor = 0;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (totalPoints >= LEVEL_THRESHOLDS[index]) {
      level = index + 1;
      floor = LEVEL_THRESHOLDS[index];
    }
  }

  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  const pointsIntoLevel = totalPoints - floor;
  const pointsForNextLevel =
    nextThreshold === null ? null : nextThreshold - floor;
  const progressPercent =
    nextThreshold === null
      ? 100
      : Math.min(100, Math.round((pointsIntoLevel / (nextThreshold - floor)) * 100));

  return {
    level,
    currentPoints: totalPoints,
    pointsIntoLevel,
    pointsForNextLevel,
    progressPercent,
  };
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function daysBetween(earlier: Date, later: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfUtcDay(later).getTime() - startOfUtcDay(earlier).getTime()) /
      msPerDay,
  );
}

function computeNextStreak(
  previousStreak: number,
  lastActivityDate: Date | null,
  now: Date,
) {
  if (!lastActivityDate) {
    return 1;
  }
  const diff = daysBetween(lastActivityDate, now);
  if (diff === 0) {
    return previousStreak;
  }
  if (diff === 1) {
    return previousStreak + 1;
  }
  return 1;
}

type AwardArgs = {
  studentId: string;
  action: GamificationAction;
  basePoints: number;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function ensureGamificationProfile(studentId: string) {
  return prisma.studentGamification.upsert({
    where: { studentId },
    update: {},
    create: { studentId },
  });
}

const SERIALIZATION_FAILURE_CODE = "P2034";
const AWARD_POINTS_MAX_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  if (error instanceof PrismaRuntime.PrismaClientKnownRequestError) {
    return error.code === SERIALIZATION_FAILURE_CODE;
  }
  return false;
}

async function awardPointsOnce(args: AwardArgs) {
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const profile = await tx.studentGamification.upsert({
        where: { studentId: args.studentId },
        update: {},
        create: { studentId: args.studentId },
      });

      const nextStreak =
        args.action === GamificationAction.CHECKIN
          ? computeNextStreak(
              profile.currentStreak,
              profile.lastActivityDate,
              now,
            )
          : profile.currentStreak;

      const bonus =
        args.action === GamificationAction.CHECKIN &&
        nextStreak > profile.currentStreak &&
        nextStreak % STREAK_BONUS_EVERY_N_DAYS === 0
          ? STREAK_BONUS_POINTS
          : 0;

      const addedCheckin = args.action === GamificationAction.CHECKIN ? 1 : 0;
      const addedAssessment =
        args.action === GamificationAction.ASSESSMENT ? 1 : 0;
      const totalPointsDelta = args.basePoints + bonus;
      const updatedStreak = Math.max(nextStreak, profile.currentStreak);
      const longestStreak = Math.max(profile.longestStreak, updatedStreak);

      await tx.studentGamification.update({
        where: { studentId: args.studentId },
        data: {
          totalPoints: { increment: totalPointsDelta },
          checkinCount: { increment: addedCheckin },
          assessmentCount: { increment: addedAssessment },
          currentStreak: updatedStreak,
          longestStreak,
          lastActivityDate:
            args.action === GamificationAction.CHECKIN
              ? startOfUtcDay(now)
              : profile.lastActivityDate,
        },
      });

      await tx.gamificationEvent.create({
        data: {
          studentId: args.studentId,
          action: args.action,
          points: args.basePoints,
          reason: args.reason,
          metadata: args.metadata,
        },
      });

      if (bonus > 0) {
        await tx.gamificationEvent.create({
          data: {
            studentId: args.studentId,
            action: GamificationAction.STREAK_BONUS,
            points: bonus,
            reason: `Bonus por ${nextStreak} dias consecutivos.`,
          },
        });
      }
    },
    {
      isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function awardPoints(args: AwardArgs) {
  for (let attempt = 0; attempt < AWARD_POINTS_MAX_RETRIES; attempt += 1) {
    try {
      await awardPointsOnce(args);
      break;
    } catch (error) {
      if (
        isSerializationFailure(error) &&
        attempt < AWARD_POINTS_MAX_RETRIES - 1
      ) {
        continue;
      }
      throw error;
    }
  }

  await evaluateBadgeUnlocks(args.studentId).catch((error: unknown) => {
    captureException(error, { source: "gamification.badge_evaluation" });
  });
}

export async function awardPointsSafely(args: AwardArgs) {
  try {
    await awardPoints(args);
  } catch (error) {
    captureException(error, { source: "gamification.awardPoints" });
  }
}

export async function evaluateBadgeUnlocks(studentId: string) {
  const profile = await prisma.studentGamification.findUnique({
    where: { studentId },
  });
  if (!profile) {
    return [];
  }

  const badges = await prisma.gamificationBadge.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const alreadyEarned = await prisma.studentBadge.findMany({
    where: { studentId },
    select: { badgeId: true },
  });
  const ownedIds = new Set(alreadyEarned.map((item) => item.badgeId));

  const newlyEarned: { id: string; code: string; name: string }[] = [];
  for (const badge of badges) {
    if (ownedIds.has(badge.id)) {
      continue;
    }

    const currentValue = (() => {
      switch (badge.requirementType) {
        case BadgeRequirementType.TOTAL_POINTS:
          return profile.totalPoints;
        case BadgeRequirementType.CHECKIN_COUNT:
          return profile.checkinCount;
        case BadgeRequirementType.CURRENT_STREAK:
          return profile.currentStreak;
        case BadgeRequirementType.ASSESSMENT_COUNT:
          return profile.assessmentCount;
        default:
          return 0;
      }
    })();

    if (currentValue >= badge.threshold) {
      try {
        await prisma.studentBadge.create({
          data: { studentId, badgeId: badge.id },
        });
        newlyEarned.push({
          id: badge.id,
          code: badge.code,
          name: badge.name,
        });
      } catch (error) {
        captureException(error, {
          source: "gamification.badge_create",
          extras: { studentId, badgeCode: badge.code },
        });
      }
    }
  }

  return newlyEarned;
}

function assertCanView(viewer: ViewerContext) {
  if (!hasPermission(viewer.role, "viewGamification")) {
    throw new ForbiddenError("Sem permissao para ver gamificacao.");
  }
}

async function assertStudentVisible(
  viewer: ViewerContext,
  studentId: string,
) {
  if (viewer.role === UserRole.ALUNO) {
    if (viewer.studentProfileId !== studentId) {
      throw new ForbiddenError("Acesso negado.");
    }
    return;
  }
  await ensureVisibleStudent(viewer, studentId);
}

export async function getStudentGamification(
  studentId: string,
  viewer: ViewerContext,
) {
  assertCanView(viewer);
  await assertStudentVisible(viewer, studentId);

  const profile = await ensureGamificationProfile(studentId);
  const [earnedBadges, recentEvents] = await Promise.all([
    prisma.studentBadge.findMany({
      where: { studentId },
      orderBy: { earnedAt: "desc" },
      include: { badge: true },
    }),
    prisma.gamificationEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    profile,
    level: calculateLevel(profile.totalPoints),
    earnedBadges,
    recentEvents,
  };
}
