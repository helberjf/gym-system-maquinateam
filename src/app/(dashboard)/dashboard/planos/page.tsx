import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import {
  formatCurrencyFromCents,
  formatMonthsLabel,
  getBillingIntervalLabel,
} from "@/lib/billing/constants";
import { getPlanStatusTone } from "@/lib/billing/presentation";
import { getPlansIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";
import { parseSearchParams, planFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Planos",
  description: "Catalogo financeiro de planos da academia.",
};

export default async function PlansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewPlans", "/dashboard/planos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    planFiltersSchema,
  );
  const data = await getPlansIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Planos"
        description="Organize o catalogo comercial da academia, recorrencias, beneficios e disponibilidade para novas assinaturas."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/planos/novo">Novo plano</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Planos cadastrados"
          value={data.summary.totalPlans}
          note="Total visivel para o seu perfil."
        />
        <MetricCard
          label="Planos ativos"
          value={data.summary.activePlans}
          note="Disponiveis para novas assinaturas."
        />
        <MetricCard
          label="Planos inativos"
          value={data.summary.inactivePlans}
          note="Mantidos apenas para historico."
        />
        <MetricCard
          label="Preco medio"
          value={formatCurrencyFromCents(data.summary.averagePriceCents)}
          note="Media do ticket mensal equivalente dos planos listados."
        />
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="search"
            placeholder="Nome, slug ou descricao"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="modalityId"
            defaultValue={filters.modalityId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as modalidades</option>
            {data.options.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          <select
            name="active"
            defaultValue={
              filters.active === undefined ? "" : filters.active ? "true" : "false"
            }
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/planos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.plans.length === 0 ? (
        <EmptyState
          title="Nenhum plano encontrado"
          description="Ajuste os filtros ou cadastre um novo plano para montar a grade comercial."
          actionLabel={data.canManage ? "Criar plano" : undefined}
          actionHref={data.canManage ? "/dashboard/planos/novo" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                    <StatusBadge tone={getPlanStatusTone(plan.active)}>
                      {plan.active ? "Ativo" : "Inativo"}
                    </StatusBadge>
                    {plan.modality ? (
                      <StatusBadge tone="info">{plan.modality.name}</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {plan.description ?? "Sem descricao detalhada."}
                  </p>
                  <p className="mt-2 text-xs text-brand-gray-light">
                    {getBillingIntervalLabel(plan.billingIntervalMonths)} • duracao{" "}
                    {formatMonthsLabel(plan.durationMonths ?? plan.billingIntervalMonths)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/planos/${plan.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Preco
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {formatCurrencyFromCents(plan.priceCents)}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Matricula {formatCurrencyFromCents(plan.enrollmentFeeCents)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Limite semanal
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {plan.isUnlimited
                      ? "Ilimitado"
                      : plan.sessionsPerWeek
                        ? `${plan.sessionsPerWeek} sessoes`
                        : "Nao definido"}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    {plan._count.subscriptions} assinatura(s) vinculada(s)
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Beneficios
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {plan.benefits.length > 0
                      ? `${plan.benefits.length} item(ns) cadastrados`
                      : "Sem beneficios cadastrados"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/planos"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
