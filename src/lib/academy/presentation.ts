import { AttendanceStatus, StudentStatus } from "@prisma/client";

export function flattenSearchParams(
  input: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export function getStudentStatusTone(status: StudentStatus) {
  switch (status) {
    case StudentStatus.ACTIVE:
      return "success" as const;
    case StudentStatus.SUSPENDED:
      return "warning" as const;
    case StudentStatus.INACTIVE:
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function getAttendanceStatusTone(status: AttendanceStatus) {
  switch (status) {
    case AttendanceStatus.CHECKED_OUT:
      return "success" as const;
    case AttendanceStatus.CHECKED_IN:
      return "info" as const;
    case AttendanceStatus.NO_SHOW:
      return "danger" as const;
    case AttendanceStatus.CANCELLED:
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}
