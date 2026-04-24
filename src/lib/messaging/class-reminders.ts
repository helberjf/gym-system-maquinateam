import { prisma } from "@/lib/prisma";
import {
  notifyClassReminder,
  WEEKDAY_LABELS_PT,
} from "@/lib/messaging/events";

type RunResult = {
  scheduled: number;
  sent: number;
  skipped: number;
  errors: number;
  targetDate: string;
};

function resolveTargetDate(now: Date): Date {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

function isClassActiveOn(
  schedule: {
    daysOfWeek: number[];
    dayOfWeek: number;
    validFrom: Date | null;
    validUntil: Date | null;
    isActive: boolean;
  },
  target: Date,
) {
  if (!schedule.isActive) {
    return false;
  }
  const targetWeekday = target.getUTCDay();
  const days =
    schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : [schedule.dayOfWeek];
  if (!days.includes(targetWeekday)) {
    return false;
  }
  if (schedule.validFrom && target < schedule.validFrom) {
    return false;
  }
  if (schedule.validUntil && target > schedule.validUntil) {
    return false;
  }
  return true;
}

export async function sendDailyClassReminders(
  now: Date = new Date(),
): Promise<RunResult> {
  const target = resolveTargetDate(now);
  const weekdayLabel = WEEKDAY_LABELS_PT[target.getUTCDay()] ?? "amanha";

  const schedules = await prisma.classSchedule.findMany({
    where: { isActive: true },
    include: {
      modality: { select: { name: true } },
      enrollments: {
        where: { isActive: true },
        select: {
          studentProfileId: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });

  let scheduled = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const schedule of schedules) {
    if (
      !isClassActiveOn(
        {
          daysOfWeek: schedule.daysOfWeek,
          dayOfWeek: schedule.dayOfWeek,
          validFrom: schedule.validFrom,
          validUntil: schedule.validUntil,
          isActive: schedule.isActive,
        },
        target,
      )
    ) {
      continue;
    }

    for (const enrollment of schedule.enrollments) {
      if (enrollment.startsAt && enrollment.startsAt > target) {
        continue;
      }
      if (enrollment.endsAt && enrollment.endsAt < target) {
        continue;
      }

      scheduled += 1;
      try {
        const result = await notifyClassReminder({
          studentProfileId: enrollment.studentProfileId,
          classTitle: schedule.title,
          modalityName: schedule.modality.name,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          dayLabel: weekdayLabel,
        });
        if (result.ok) {
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch {
        errors += 1;
      }
    }
  }

  return {
    scheduled,
    sent,
    skipped,
    errors,
    targetDate: target.toISOString().slice(0, 10),
  };
}
