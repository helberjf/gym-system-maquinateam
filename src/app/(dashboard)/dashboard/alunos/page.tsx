import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatDate, getStudentStatusLabel } from "@/lib/academy/constants";
import {
  flattenSearchParams,
  getStudentStatusTone,
} from "@/lib/academy/presentation";
import { getStudentsIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";
import { parseSearchParams, studentFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Alunos",
  description: "Gestao de alunos, status e vinculos operacionais.",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewStudents", "/dashboard/alunos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    studentFiltersSchema,
  );
  const data = await getStudentsIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Alunos"
        description="Cadastre, edite, acompanhe status e veja os vinculos principais dos alunos."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/alunos/novo">Novo aluno</Link>
            </Button>
          ) : null
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            name="search"
            placeholder="Nome, e-mail ou matricula"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="SUSPENDED">Inadimplente</option>
            <option value="INACTIVE">Inativo</option>
            <option value="TRIAL">Experimental</option>
            <option value="PENDING">Pendente</option>
          </select>
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
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/alunos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.students.length === 0 ? (
        <EmptyState
          title="Nenhum aluno encontrado"
          description="Ajuste os filtros ou cadastre um novo aluno para iniciar o modulo."
          actionLabel={data.canManage ? "Criar aluno" : undefined}
          actionHref={data.canManage ? "/dashboard/alunos/novo" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.students.map((student) => (
            <article
              key={student.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {student.user.name}
                    </h2>
                    <StatusBadge tone={getStudentStatusTone(student.status)}>
                      {getStudentStatusLabel(student.status)}
                    </StatusBadge>
                    {!student.user.isActive ? (
                      <StatusBadge tone="danger">Acesso bloqueado</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {student.user.email}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Matricula {student.registrationNumber} • desde {formatDate(student.joinedAt)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/alunos/${student.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Vinculos
                  </p>
                  <p className="mt-3 text-sm text-white">
                    Modalidade principal: {student.primaryModality?.name ?? "Nao definida"}
                  </p>
                  <p className="mt-1 text-sm text-white">
                    Professor responsavel: {student.responsibleTeacher?.user.name ?? "Nao definido"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Atividade
                  </p>
                  <p className="mt-3 text-sm text-white">
                    Turmas vinculadas: {student._count.enrollments}
                  </p>
                  <p className="mt-1 text-sm text-white">
                    Registros de presenca: {student._count.attendances}
                  </p>
                </div>
              </div>

              {student.enrollments.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {student.enrollments.map((enrollment) => (
                    <StatusBadge key={enrollment.id} tone="info">
                      {enrollment.classSchedule.title}
                    </StatusBadge>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-brand-gray-light">
                  Nenhuma turma ativa vinculada no momento.
                </p>
              )}
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/alunos"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
