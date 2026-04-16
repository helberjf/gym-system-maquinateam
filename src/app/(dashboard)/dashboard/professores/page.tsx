import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { getTeachersIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";
import { parseSearchParams, teacherFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Professores",
  description: "Gestao de professores e modalidades ensinadas.",
};

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewTeachers", "/dashboard/professores");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    teacherFiltersSchema,
  );
  const data = await getTeachersIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipe"
        title="Professores"
        description="Gerencie docentes, modalidades ensinadas e vinculos com turmas."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/professores/novo">Novo professor</Link>
            </Button>
          ) : null
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="search"
            placeholder="Nome ou e-mail"
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
          <label className="flex items-center gap-3 rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              name="onlyInactive"
              value="true"
              defaultChecked={filters.onlyInactive === true}
              className="h-4 w-4 accent-brand-red"
            />
            Mostrar inativos
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/professores">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.teachers.length === 0 ? (
        <EmptyState
          title="Nenhum professor encontrado"
          description="Ajuste os filtros ou cadastre um novo professor."
          actionLabel={data.canManage ? "Criar professor" : undefined}
          actionHref={data.canManage ? "/dashboard/professores/novo" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.teachers.map((teacher) => (
            <article
              key={teacher.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {teacher.user.name}
                    </h2>
                    <StatusBadge tone={teacher.isActive ? "success" : "danger"}>
                      {teacher.isActive ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {teacher.user.email}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Registro {teacher.registrationNumber ?? "Nao definido"}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/professores/${teacher.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Especialidades
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {teacher.specialties ?? "Sem observacoes preenchidas"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Operacao
                  </p>
                  <p className="mt-3 text-sm text-white">
                    Turmas: {teacher._count.classes}
                  </p>
                  <p className="mt-1 text-sm text-white">
                    Alunos responsaveis: {teacher._count.responsibleStudents}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {teacher.modalities.map((modality) => (
                  <StatusBadge key={modality.id} tone="info">
                    {modality.name}
                  </StatusBadge>
                ))}
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/professores"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
