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
import {
  formatCurrencyFromCents,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  PAYMENT_METHOD_FILTER_OPTIONS,
} from "@/lib/billing/constants";
import { resolvePaymentTone } from "@/lib/billing/presentation";
import { getPaymentsIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";
import { parseSearchParams, paymentFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Pagamentos",
  description: "Mensalidades, inadimplencia e historico de cobrancas.",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewPayments", "/dashboard/pagamentos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    paymentFiltersSchema,
  );
  const data = await getPaymentsIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos e mensalidades"
        description="Registre vencimentos manuais, pagamentos avulsos e acompanhe a inadimplencia por aluno e assinatura."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/pagamentos/novo">Novo pagamento</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Em aberto"
          value={data.summary.pendingPayments}
          note={`Total pendente: ${formatCurrencyFromCents(data.summary.outstandingCents)}`}
        />
        <MetricCard
          label="Atrasados"
          value={data.summary.overduePayments}
          note={`Inadimplencia: ${formatCurrencyFromCents(data.summary.overdueCents)}`}
        />
        <MetricCard
          label="Recebidos"
          value={data.summary.paidPayments}
          note={`Entradas: ${formatCurrencyFromCents(data.summary.receivedCents)}`}
        />
        <MetricCard
          label="Alunos inadimplentes"
          value={data.summary.delinquentStudents}
          note="Quantidade unica de alunos com vencimento passado."
        />
      </section>

      {data.summary.overduePayments > 0 ? (
        <section className="rounded-2xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Visao de inadimplencia</h2>
          <p className="mt-2 text-sm text-brand-gray-light">
            Existem {data.summary.overduePayments} cobranca(s) atrasada(s), somando{" "}
            {formatCurrencyFromCents(data.summary.overdueCents)}.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          <input
            name="search"
            placeholder="Aluno, matricula ou descricao"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Atrasado</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <select
            name="method"
            defaultValue={filters.method ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os metodos</option>
            {PAYMENT_METHOD_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
              <Link href="/dashboard/pagamentos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.payments.length === 0 ? (
        <EmptyState
          title="Nenhum pagamento encontrado"
          description="Crie uma mensalidade ou ajuste os filtros para localizar cobrancas existentes."
          actionLabel={data.canManage ? "Criar pagamento" : undefined}
          actionHref={data.canManage ? "/dashboard/pagamentos/novo" : undefined}
        />
      ) : (
        <>
        <section className="space-y-4">
          {data.payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {payment.studentProfile.user.name}
                    </h2>
                    <StatusBadge
                      tone={resolvePaymentTone({
                        status: payment.status,
                        dueDate: payment.dueDate,
                      })}
                    >
                      {getPaymentStatusLabel(payment.status, payment.dueDate)}
                    </StatusBadge>
                    <StatusBadge tone="info">
                      {getPaymentMethodLabel(payment.method)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {payment.subscription.plan.name}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Matricula {payment.studentProfile.registrationNumber} • vence em{" "}
                    {formatDate(payment.dueDate)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/pagamentos/${payment.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Valor
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {formatCurrencyFromCents(payment.amountCents)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Pagamento
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {payment.paidAt ? formatDate(payment.paidAt) : "Ainda nao pago"}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Descricao
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {payment.description ?? "Mensalidade manual sem descricao complementar"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/pagamentos"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
