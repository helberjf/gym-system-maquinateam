import {
  AttendanceStatus,
  StudentStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Domingo", shortLabel: "Dom" },
  { value: 1, label: "Segunda", shortLabel: "Seg" },
  { value: 2, label: "Terca", shortLabel: "Ter" },
  { value: 3, label: "Quarta", shortLabel: "Qua" },
  { value: 4, label: "Quinta", shortLabel: "Qui" },
  { value: 5, label: "Sexta", shortLabel: "Sex" },
  { value: 6, label: "Sabado", shortLabel: "Sab" },
] as const;

export const WEEKDAY_LABEL_MAP = Object.fromEntries(
  WEEKDAY_OPTIONS.map((item) => [item.value, item.label]),
) as Record<number, string>;

export const WEEKDAY_SHORT_LABEL_MAP = Object.fromEntries(
  WEEKDAY_OPTIONS.map((item) => [item.value, item.shortLabel]),
) as Record<number, string>;

export const ROLE_LABEL_MAP: Record<UserRole, string> = {
  ADMIN: "Administrador",
  RECEPCAO: "Recepcao",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};

export const STUDENT_STATUS_OPTIONS = [
  { value: StudentStatus.ACTIVE, label: "Ativo" },
  { value: StudentStatus.SUSPENDED, label: "Inadimplente" },
  { value: StudentStatus.INACTIVE, label: "Inativo" },
  { value: StudentStatus.TRIAL, label: "Experimental" },
  { value: StudentStatus.PENDING, label: "Pendente" },
] as const;

export const STUDENT_STATUS_LABEL_MAP = Object.fromEntries(
  STUDENT_STATUS_OPTIONS.map((item) => [item.value, item.label]),
) as Record<StudentStatus, string>;

export const ATTENDANCE_STATUS_LABEL_MAP: Record<AttendanceStatus, string> = {
  PENDING: "Pendente",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  NO_SHOW: "Falta",
  CANCELLED: "Cancelado",
};

export const SUBSCRIPTION_STATUS_LABEL_MAP: Record<SubscriptionStatus, string> =
  {
    PENDING: "Pendente",
    ACTIVE: "Ativa",
    PAST_DUE: "Em atraso",
    PAUSED: "Pausada",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
  };

export function normalizeWeekdays(days: number[]) {
  return Array.from(new Set(days)).sort((left, right) => left - right);
}

export function getWeekdayLabels(days: number[]) {
  return normalizeWeekdays(days).map(
    (day) => WEEKDAY_SHORT_LABEL_MAP[day] ?? `Dia ${day}`,
  );
}

export function getStudentStatusLabel(status: StudentStatus) {
  return STUDENT_STATUS_LABEL_MAP[status] ?? status;
}

export function getAttendanceStatusLabel(status: AttendanceStatus) {
  return ATTENDANCE_STATUS_LABEL_MAP[status] ?? status;
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime} - ${endTime}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildRegistrationNumber(prefix: "ALU" | "PROF", seed: string) {
  const normalized = seed.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `${prefix}-${normalized.padStart(8, "0")}`;
}

export function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function toDateInputValue(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}
