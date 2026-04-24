import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QrCheckInScanner } from "@/components/dashboard/QrCheckInScanner";
import { getWeekdayLabels } from "@/lib/academy/constants";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Check-in por QR",
  description: "Escaneie o codigo do aluno para registrar presenca.",
};

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  await requirePermission("manageAttendance", "/dashboard/presenca");

  const schedules = await prisma.classSchedule.findMany({
    where: { isActive: true },
    orderBy: [{ startTime: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      daysOfWeek: true,
      dayOfWeek: true,
      modality: { select: { name: true } },
    },
  });

  const scheduleOptions = schedules.map((schedule) => {
    const days = getWeekdayLabels(
      schedule.daysOfWeek.length > 0
        ? schedule.daysOfWeek
        : [schedule.dayOfWeek],
    ).join(", ");
    return {
      id: schedule.id,
      label: `${schedule.title} - ${schedule.modality.name} - ${days} (${schedule.startTime}-${schedule.endTime})`,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Presenca"
        title="Check-in por QR code"
        description="Selecione a turma e aponte a camera para o QR do aluno."
      />

      <QrCheckInScanner scheduleOptions={scheduleOptions} />
    </div>
  );
}
