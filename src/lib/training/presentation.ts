import { TrainingAssignmentStatus } from "@prisma/client";

export function getTrainingAssignmentTone(status: TrainingAssignmentStatus) {
  switch (status) {
    case TrainingAssignmentStatus.ASSIGNED:
      return "warning" as const;
    case TrainingAssignmentStatus.IN_PROGRESS:
      return "info" as const;
    case TrainingAssignmentStatus.COMPLETED:
      return "success" as const;
    case TrainingAssignmentStatus.MISSED:
      return "danger" as const;
    case TrainingAssignmentStatus.CANCELLED:
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function getAnnouncementTone(input: {
  isPinned: boolean;
  isPublished: boolean;
  expired: boolean;
}) {
  if (!input.isPublished || input.expired) {
    return "neutral" as const;
  }

  if (input.isPinned) {
    return "warning" as const;
  }

  return "info" as const;
}
