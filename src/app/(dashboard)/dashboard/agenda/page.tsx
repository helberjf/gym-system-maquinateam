import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/Button";
import { requirePermission } from "@/lib/auth/guards";
import { WEEKDAY_OPTIONS } from "@/lib/academy/constants";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Agenda operacional",
  description: "Calendario visual semanal de turmas, professores e ocupacao.",
};

export const dynamic = "force-dynamic";

function getScheduleDays(schedule: { dayOfWeek: number; daysOfWeek: number[] }) {
  return schedule.daysOfWeek.length > 0
    ? schedule.daysOfWeek
    : [schedule.dayOfWeek];
}

function getOccupancyTone(current: number, capacity?: number | null) {
  if (!capacity || capacity <= 0) {
    return "info";
  }

  const ratio = current / capacity;
  if (ratio >= 0.9) {
    return "danger";
  }
  if (ratio >= 0.7) {
    return "warning";
  }
  return "success";
}

export default async function OperationalAgendaPage() {
  await requirePermission("viewClassSchedules", "/dashboard/agenda");

  const weekdayOptions = WEEKDAY_OPTIONS;
  const schedules = await prisma.classSchedule.findMany({
    where: { isActive: true },
    orderBy: [{ startTime: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      dayOfWeek: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      capacity: true,
      modality: {
        select: {
          name: true,
          colorHex: true,
        },
      },
      teacherProfile: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      enrollments: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const schedulesByDay = weekdayOptions.map((option) => ({
    day: option.value,
    label: option.label,
    schedules: schedules.filter((schedule) =>
      getScheduleDays(schedule).includes(option.value),
    ),
  }));

  const busiestDay = schedulesByDay
    .slice()
    .sort((left, right) => right.schedules.length - left.schedules.length)[0];
  const totalSlots = schedulesByDay.reduce(
    (acc, day) => acc + day.schedules.length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agenda"
        title="Calendario operacional"
        description="Grade visual para acompanhar turmas ativas, professores, salas e ocupacao da semana."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/turmas">Gerenciar turmas</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-gray-light">
            Turmas na semana
          </p>
          <p className="mt-2 text-3xl font-black text-white">{totalSlots}</p>
        </article>
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-gray-light">
            Dia mais cheio
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {busiestDay?.label ?? "-"}
          </p>
        </article>
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-gray-light">
            Professores ativos
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {
              new Set(
                schedules.map((schedule) => schedule.teacherProfile.user.name),
              ).size
            }
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-7">
        {schedulesByDay.map((day) => (
          <article
            key={day.day}
            className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white">{day.label}</h2>
              <StatusBadge tone="neutral">
                {day.schedules.length} aula(s)
              </StatusBadge>
            </div>

            <div className="mt-4 space-y-3">
              {day.schedules.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-brand-gray-mid p-4 text-sm text-brand-gray-light">
                  Sem turmas ativas.
                </p>
              ) : (
                day.schedules.map((schedule) => {
                  const activeEnrollments = schedule.enrollments.length;
                  return (
                    <Link
                      key={`${day.day}-${schedule.id}`}
                      href={`/dashboard/turmas/${schedule.id}`}
                      className="block rounded-2xl border border-brand-gray-mid bg-brand-black/35 p-4 transition hover:border-brand-red/45"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white">
                          {schedule.startTime} - {schedule.endTime}
                        </p>
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              schedule.modality.colorHex ?? "#e10600",
                          }}
                        />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-white">
                        {schedule.title}
                      </h3>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {schedule.modality.name} - {schedule.teacherProfile.user.name}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge
                          tone={getOccupancyTone(activeEnrollments, schedule.capacity)}
                        >
                          {activeEnrollments}
                          {schedule.capacity ? `/${schedule.capacity}` : ""} alunos
                        </StatusBadge>
                        {schedule.room ? (
                          <StatusBadge tone="info">{schedule.room}</StatusBadge>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
