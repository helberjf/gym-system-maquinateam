import { BRAND } from "@/lib/constants/brand";
import { captureException } from "@/lib/observability/capture";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTextSafely } from "@/lib/messaging/whatsapp";

type StudentContact = {
  studentProfileId: string;
  studentName: string;
  phone: string | null;
  whatsappOptIn: boolean;
};

async function loadStudentContact(
  studentProfileId: string,
): Promise<StudentContact | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      id: true,
      whatsappOptIn: true,
      user: {
        select: { name: true, phone: true },
      },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    studentProfileId: profile.id,
    studentName: profile.user.name,
    phone: profile.user.phone?.trim() || null,
    whatsappOptIn: profile.whatsappOptIn,
  };
}

function formatClassTime(startTime: string, endTime: string) {
  return `${startTime} - ${endTime}`;
}

export function buildClassReminderMessage(params: {
  studentName: string;
  classTitle: string;
  modalityName: string;
  startTime: string;
  endTime: string;
  dayLabel: string;
}) {
  return `Ola ${params.studentName}! Lembrando que amanha (${params.dayLabel}) voce tem aula de ${params.modalityName} - ${params.classTitle} das ${formatClassTime(params.startTime, params.endTime)}. Nos vemos la! - ${BRAND.name}`;
}

export function buildTrainingPlanMessage(params: {
  studentName: string;
  planTitle: string;
}) {
  return `Ola ${params.studentName}! Seu novo plano de treino "${params.planTitle}" ja esta disponivel no app. Acesse para conferir os exercicios. Bons treinos! - ${BRAND.name}`;
}

export function buildNutritionPlanMessage(params: {
  studentName: string;
  planTitle: string;
}) {
  return `Ola ${params.studentName}! Seu novo plano alimentar "${params.planTitle}" esta disponivel no app. Acesse para conferir as refeicoes recomendadas. - ${BRAND.name}`;
}

async function sendIfOptedIn(
  contact: StudentContact | null,
  message: string,
  source: string,
) {
  if (!contact) {
    return { ok: false, skipped: "student_not_found" as const };
  }
  if (!contact.whatsappOptIn) {
    return { ok: false, skipped: "opted_out" as const };
  }
  if (!contact.phone) {
    return { ok: false, skipped: "no_phone" as const };
  }

  try {
    const result = await sendWhatsAppTextSafely({
      to: contact.phone,
      message,
    });
    return result;
  } catch (error) {
    captureException(error, {
      source,
      extras: { studentProfileId: contact.studentProfileId },
    });
    return { ok: false, skipped: "send_error" as const };
  }
}

export async function notifyTrainingPlanCreated(params: {
  studentProfileId: string;
  planTitle: string;
}) {
  const contact = await loadStudentContact(params.studentProfileId);
  if (!contact) {
    return { ok: false, skipped: "student_not_found" as const };
  }
  const message = buildTrainingPlanMessage({
    studentName: contact.studentName,
    planTitle: params.planTitle,
  });
  return sendIfOptedIn(contact, message, "messaging training plan");
}

export async function notifyNutritionPlanCreated(params: {
  studentProfileId: string;
  planTitle: string;
}) {
  const contact = await loadStudentContact(params.studentProfileId);
  if (!contact) {
    return { ok: false, skipped: "student_not_found" as const };
  }
  const message = buildNutritionPlanMessage({
    studentName: contact.studentName,
    planTitle: params.planTitle,
  });
  return sendIfOptedIn(contact, message, "messaging nutrition plan");
}

export async function notifyClassReminder(params: {
  studentProfileId: string;
  classTitle: string;
  modalityName: string;
  startTime: string;
  endTime: string;
  dayLabel: string;
}) {
  const contact = await loadStudentContact(params.studentProfileId);
  if (!contact) {
    return { ok: false, skipped: "student_not_found" as const };
  }
  const message = buildClassReminderMessage({
    studentName: contact.studentName,
    classTitle: params.classTitle,
    modalityName: params.modalityName,
    startTime: params.startTime,
    endTime: params.endTime,
    dayLabel: params.dayLabel,
  });
  return sendIfOptedIn(contact, message, "messaging class reminder");
}

export const WEEKDAY_LABELS_PT: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};
