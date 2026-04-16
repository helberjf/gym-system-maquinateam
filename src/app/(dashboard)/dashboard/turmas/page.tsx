import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getWeekdayLabels } from "@/lib/academy/constants";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { getClassSchedulesIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";
import { classScheduleFiltersSchema, parseSearchParams } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Turmas",
  description: "Turmas, horarios e vinculos operacionais da academia.",
};

export default async function ClassSchedulesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission(
    "viewClassSchedules",
    "/dashboard/turmas",
  );
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    classScheduleFiltersSchema,
  );
  const data = await getClassSchedulesIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agenda"
        title="Turmas e horarios"
        description="Acompanhe a grade, os vinculos de alunos e o professor responsavel por cada turma."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/turmas/nova">Nova turma</Link>
            </Button>
          ) : null
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            name="search"
            placeholder="Nome da turma ou sala"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="modalityId"
            defaultValue={filters.modalityId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as modalidades</option>
            {data.options?.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          <select
            name="teacherId"
            defaultValue={filters.teacherId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os professores</option>
            {data.options?.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.user.name}
              </option>
            ))}
          </select>
          <select
            name="dayOfWeek"
            defaultValue={filters.dayOfWeek?.toString() ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os dias</option>
            <option value="1">Segunda</option>
            <option value="2">Terca</option>
            <option value="3">Quarta</option>
            <option value="4">Quinta</option>
            <option value="5">Sexta</option>
            <option value="6">Sabado</option>
            <option value="0">Domingo</option>
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/turmas">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.classSchedules.length === 0 ? (
        <EmptyState
          title="Nenhuma turma encontrada"
          description="Ajuste os filtros ou crie uma nova turma."
          actionLabel={data.canManage ? "Criar turma" : undefined}
          actionHref={data.canManage ? "/dashboard/turmas/nova" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.classSchedules.map((classSchedule) => (
            <article
              key={classSchedule.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {classSchedule.title}
                    </h2>
                    <StatusBadge tone={classSchedule.isActive ? "success" : "danger"}>
                      {classSchedule.isActive ? "Ativa" : "Arquivada"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {classSchedule.modality.name} • {classSchedule.teacherProfile.user.name}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    {getWeekdayLabels(
                      classSchedule.daysOfWeek.length > 0
                        ? classSchedule.daysOfWeek
                        : [classSchedule.dayOfWeek],
                    ).join(", ")} • {classSchedule.startTime} - {classSchedule.endTime}
                  </p>
                </div>
                <Button asChild variant="secondary">
                  <Link href={`/dashboard/turmas/${classSchedule.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Sala
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {classSchedule.room ?? "Nao definida"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Alunos
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {classSchedule._count.enrollments}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Capacidade
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {classSchedule.capacity ?? "Sem limite"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/turmas"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
