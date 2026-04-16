import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { getModalitiesIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";
import { modalityFiltersSchema, parseSearchParams } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Modalidades",
  description: "Catalogo operacional de modalidades da academia.",
};

export default async function ModalitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewModalities", "/dashboard/modalidades");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    modalityFiltersSchema,
  );
  const data = await getModalitiesIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogo"
        title="Modalidades"
        description="Mantenha a base de modalidades usada por alunos, professores e turmas."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/modalidades/nova">Nova modalidade</Link>
            </Button>
          ) : null
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <input
            name="search"
            placeholder="Nome ou descricao"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <label className="flex items-center gap-3 rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              name="onlyInactive"
              value="true"
              defaultChecked={filters.onlyInactive === true}
              className="h-4 w-4 accent-brand-red"
            />
            Mostrar arquivadas
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/modalidades">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.modalities.length === 0 ? (
        <EmptyState
          title="Nenhuma modalidade encontrada"
          description="Ajuste os filtros ou cadastre uma nova modalidade."
          actionLabel={data.canManage ? "Criar modalidade" : undefined}
          actionHref={data.canManage ? "/dashboard/modalidades/nova" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.modalities.map((modality) => (
            <article
              key={modality.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{modality.name}</h2>
                    <StatusBadge tone={modality.isActive ? "success" : "danger"}>
                      {modality.isActive ? "Ativa" : "Arquivada"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {modality.description ?? "Sem descricao cadastrada"}
                  </p>
                </div>
                <Button asChild variant="secondary">
                  <Link href={`/dashboard/modalidades/${modality.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Turmas
                  </p>
                  <p className="mt-3 text-2xl font-black text-white">
                    {modality._count.classSchedules}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Professores
                  </p>
                  <p className="mt-3 text-2xl font-black text-white">
                    {modality._count.teachers}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Alunos principais
                  </p>
                  <p className="mt-3 text-2xl font-black text-white">
                    {modality._count.primaryStudents}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/modalidades"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
