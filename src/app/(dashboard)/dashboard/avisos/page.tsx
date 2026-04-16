import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatDate } from "@/lib/academy/constants";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import { getAnnouncementTargetLabel } from "@/lib/training/constants";
import { getAnnouncementTone } from "@/lib/training/presentation";
import { getAnnouncementsIndexData } from "@/lib/training/service";
import { announcementFiltersSchema, parseSearchParams } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Avisos",
  description: "Comunicados da academia publicados para cada perfil.",
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewAnnouncements", "/dashboard/avisos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    announcementFiltersSchema,
  );
  const data = await getAnnouncementsIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comunicacao"
        title="Avisos e comunicados"
        description={
          data.canManage
            ? "Publique recados para a academia, recepcao, professores ou alunos vinculados."
            : "Acompanhe os comunicados ativos publicados para o seu perfil."
        }
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/avisos/novo">Novo aviso</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visiveis agora" value={data.summary.total} note="Total retornado com os filtros atuais." />
        <MetricCard label="Publicados" value={data.summary.published} note="Avisos ativos e prontos para leitura." />
        <MetricCard label="Fixados" value={data.summary.pinned} note="Com maior destaque no painel." />
        <MetricCard
          label="Expiram em breve"
          value={data.summary.expiringSoon}
          note="Com prazo para encerrar nos proximos 7 dias."
        />
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            name="search"
            placeholder="Titulo, resumo ou conteudo"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          {data.canManage ? (
            <select
              name="targetRole"
              defaultValue={filters.targetRole ?? ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todos os publicos</option>
              <option value="ALUNO">Alunos</option>
              <option value="PROFESSOR">Professores</option>
              <option value="RECEPCAO">Recepcao</option>
              <option value="ADMIN">Administracao</option>
            </select>
          ) : null}
          {data.canManage ? (
            <select
              name="isPublished"
              defaultValue={
                filters.isPublished === undefined ? "" : filters.isPublished ? "true" : "false"
              }
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todos os status</option>
              <option value="true">Publicados</option>
              <option value="false">Rascunhos</option>
            </select>
          ) : null}
          <div className="flex items-center gap-3 xl:col-span-2">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/avisos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.announcements.length === 0 ? (
        <EmptyState
          title="Nenhum aviso encontrado"
          description="Ajuste os filtros ou publique um novo comunicado para aparecer aqui."
          actionLabel={data.canManage ? "Criar aviso" : undefined}
          actionHref={data.canManage ? "/dashboard/avisos/novo" : undefined}
        />
      ) : (
        <>
        <section className="space-y-4">
          {data.announcements.map((announcement) => {
            const expired = Boolean(
              announcement.expiresAt && announcement.expiresAt.getTime() <= Date.now(),
            );

            return (
              <article
                key={announcement.id}
                className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{announcement.title}</h2>
                      <StatusBadge
                        tone={getAnnouncementTone({
                          isPinned: announcement.isPinned,
                          isPublished: announcement.isPublished,
                          expired,
                        })}
                      >
                        {announcement.isPublished ? (expired ? "Expirado" : "Publicado") : "Rascunho"}
                      </StatusBadge>
                      {announcement.isPinned ? <StatusBadge tone="warning">Fixado</StatusBadge> : null}
                      <StatusBadge tone="info">
                        {getAnnouncementTargetLabel(announcement.targetRole)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-brand-gray-light">
                      {announcement.excerpt ?? "Sem resumo curto cadastrado."}
                    </p>
                    <p className="mt-2 text-xs text-brand-gray-light">
                      Publicado em {formatDate(announcement.publishedAt ?? announcement.createdAt)} • por{" "}
                      {announcement.createdByUser.name}
                    </p>
                  </div>

                  <Button asChild variant="secondary">
                    <Link href={`/dashboard/avisos/${announcement.id}`}>Abrir aviso</Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </section>

        <PaginationControls
          pathname="/dashboard/avisos"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
