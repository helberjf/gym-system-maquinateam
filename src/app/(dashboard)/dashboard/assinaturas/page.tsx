import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/academy/constants";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import {
  formatCurrencyFromCents,
  getSubscriptionStatusLabel,
} from "@/lib/billing/constants";
import { getSubscriptionStatusTone } from "@/lib/billing/presentation";
import { getSubscriptionsIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";
import { parseSearchParams, subscriptionFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Assinaturas",
  description: "Gestao de assinaturas e contratos de alunos.",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission(
    "viewSubscriptions",
    "/dashboard/assinaturas",
  );
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    subscriptionFiltersSchema,
  );
  const data = await getSubscriptionsIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Assinaturas"
        description="Acompanhe contratos ativos, renovacoes, periodos e o vinculo entre alunos e planos."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/assinaturas/nova">Nova assinatura</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Assinaturas visiveis"
          value={data.summary.totalSubscriptions}
          note="Total conforme o seu perfil e filtros aplicados."
        />
        <MetricCard
          label="Ativas"
          value={data.summary.activeSubscriptions}
          note="Contratos em funcionamento."
        />
        <MetricCard
          label="Em atraso"
          value={data.summary.overdueSubscriptions}
          note="Assinaturas com risco financeiro ou inadimplencia."
        />
        <MetricCard
          label="Receita contratada"
          value={formatCurrencyFromCents(data.summary.recurringRevenueCents)}
          note={`${data.summary.autoRenewSubscriptions} com renovacao automatica.`}
        />
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          <input
            name="search"
            placeholder="Aluno, matricula ou plano"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativa</option>
            <option value="PAST_DUE">Em atraso</option>
            <option value="PENDING">Pendente</option>
            <option value="PAUSED">Pausada</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="EXPIRED">Expirada</option>
          </select>
          <select
            name="studentId"
            defaultValue={filters.studentId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os alunos</option>
            {data.options?.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.user.name}
              </option>
            ))}
          </select>
          <select
            name="planId"
            defaultValue={filters.planId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os planos</option>
            {data.options?.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <input
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <input
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/assinaturas">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.subscriptions.length === 0 ? (
        <EmptyState
          title="Nenhuma assinatura encontrada"
          description="Ajuste os filtros ou crie uma nova assinatura para vincular alunos a planos."
          actionLabel={data.canManage ? "Criar assinatura" : undefined}
          actionHref={data.canManage ? "/dashboard/assinaturas/nova" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.subscriptions.map((subscription) => {
            const nextPendingPayment = subscription.payments[0];

            return (
              <article
                key={subscription.id}
                className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">
                        {subscription.studentProfile.user.name}
                      </h2>
                      <StatusBadge tone={getSubscriptionStatusTone(subscription.status)}>
                        {getSubscriptionStatusLabel(subscription.status)}
                      </StatusBadge>
                      {!subscription.studentProfile.user.isActive ? (
                        <StatusBadge tone="danger">Conta inativa</StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-brand-gray-light">
                      {subscription.plan.name}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      Matricula {subscription.studentProfile.registrationNumber} • inicio{" "}
                      {formatDate(subscription.startDate)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {session.user.role === "ALUNO" &&
                    subscription.checkoutPayment?.status === "PENDING" &&
                    subscription.checkoutPayment.checkoutUrl ? (
                      <Button asChild>
                        <a href={subscription.checkoutPayment.checkoutUrl}>Pagar agora</a>
                      </Button>
                    ) : null}
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/assinaturas/${subscription.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Valor liquido
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {formatCurrencyFromCents(
                        Math.max(0, subscription.priceCents - subscription.discountCents),
                      )}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      Desconto {formatCurrencyFromCents(subscription.discountCents)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Renovacao
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {subscription.autoRenew
                        ? `Dia ${subscription.renewalDay ?? "-"}`
                        : "Manual"}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      Fim {formatDate(subscription.endDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Cobranca aberta
                    </p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {nextPendingPayment
                        ? formatCurrencyFromCents(nextPendingPayment.amountCents)
                        : "Sem cobranca"}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      {nextPendingPayment
                        ? `Vence em ${formatDate(nextPendingPayment.dueDate)}`
                        : `${subscription._count.payments} pagamento(s) registrado(s)`}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <PaginationControls
          pathname="/dashboard/assinaturas"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
