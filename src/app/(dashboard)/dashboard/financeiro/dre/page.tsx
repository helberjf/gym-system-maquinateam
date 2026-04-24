import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SimpleBarChart } from "@/components/dashboard/SimpleBarChart";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { EXPENSE_CATEGORY_LABELS, getDreReport } from "@/lib/reports/dre";
import { dreFiltersSchema, parseSearchParams } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "DRE Financeiro",
  description: "Receita, taxas, despesas e resultado do periodo.",
};

export const dynamic = "force-dynamic";

function buildExportHref(filters: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  const query = params.toString();
  return `/api/reports/dre/export${query ? `?${query}` : ""}`;
}

function formatResultTone(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-brand-red";
  }
  return "text-white";
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewFinancialReports");
  const viewer = await getViewerContextFromSession(session);
  const filters = parseSearchParams(
    flattenSearchParams(await searchParams),
    dreFiltersSchema,
  );
  const report = await getDreReport(viewer, filters);

  const revenueChartPoints = report.monthlyTrend.map((point) => ({
    label: point.label,
    value: point.revenueCents,
    note: point.monthKey,
  }));
  const resultChartPoints = report.monthlyTrend.map((point) => ({
    label: point.label,
    value: point.resultCents,
    note: point.monthKey,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="DRE do periodo"
        description="Receitas, taxas MercadoPago, despesas e resultado consolidado em regime de caixa."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <Button type="submit" className="justify-self-start">
            Aplicar filtro
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm">
            <a href={buildExportHref(filters)}>CSV DRE</a>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita liquida"
          value={formatCurrencyFromCents(report.revenue.netCents)}
          note={`Bruto ${formatCurrencyFromCents(report.revenue.grossCents)} - estornos ${formatCurrencyFromCents(report.revenue.refundsCents)}`}
        />
        <MetricCard
          label="Taxas MercadoPago"
          value={formatCurrencyFromCents(report.feesCents)}
          note="Capturadas automaticamente do webhook."
        />
        <MetricCard
          label="Despesas operacionais"
          value={formatCurrencyFromCents(report.manualExpensesCents)}
          note={`${report.expensesByCategory.filter((entry) => entry.category !== "MP_FEE").length} categoria(s).`}
        />
        <MetricCard
          label="Resultado"
          value={formatCurrencyFromCents(report.resultCents)}
          note={
            report.resultCents >= 0
              ? "Lucro no periodo."
              : "Prejuizo no periodo."
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Detalhamento da receita</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">Assinaturas</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.subscriptionsCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">Vendas internas</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.internalSalesCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">Loja online</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.storeOrdersCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-brand-gray-mid pt-3">
              <dt className="font-semibold text-white">Receita bruta</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.grossCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">(-) Estornos</dt>
              <dd className="font-semibold text-brand-red">
                {formatCurrencyFromCents(report.revenue.refundsCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-brand-gray-mid pt-3">
              <dt className="font-semibold text-white">Receita liquida</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.netCents)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Despesas por categoria</h2>
          {report.expensesByCategory.length === 0 ? (
            <p className="mt-4 text-sm text-brand-gray-light">
              Nenhuma despesa registrada no periodo.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {report.expensesByCategory.map((entry) => (
                <li
                  key={entry.category}
                  className="flex items-center justify-between rounded-xl border border-brand-gray-mid bg-brand-black/40 px-3 py-2"
                >
                  <span className="text-brand-gray-light">
                    {EXPENSE_CATEGORY_LABELS[entry.category]}
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrencyFromCents(entry.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Resumo contabil</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">Receita liquida</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.revenue.netCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">(-) Taxas MP</dt>
              <dd className="font-semibold text-brand-red">
                {formatCurrencyFromCents(report.feesCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-brand-gray-mid pt-3">
              <dt className="font-semibold text-white">Lucro bruto</dt>
              <dd className="font-semibold text-white">
                {formatCurrencyFromCents(report.grossProfitCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-gray-light">(-) Despesas operacionais</dt>
              <dd className="font-semibold text-brand-red">
                {formatCurrencyFromCents(report.manualExpensesCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-brand-gray-mid pt-3">
              <dt className="font-semibold text-white">Resultado</dt>
              <dd className={`font-semibold ${formatResultTone(report.resultCents)}`}>
                {formatCurrencyFromCents(report.resultCents)}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SimpleBarChart
          title="Receita por mes"
          description="Receita mensal em regime de caixa nos ultimos 6 meses."
          points={revenueChartPoints}
          formatter={(value) => formatCurrencyFromCents(value)}
          tone="emerald"
        />
        <SimpleBarChart
          title="Resultado por mes"
          description="Receita menos despesas, mes a mes."
          points={resultChartPoints.map((point) => ({
            ...point,
            value: Math.max(point.value, 0),
            note: formatCurrencyFromCents(
              report.monthlyTrend.find((m) => m.monthKey === point.note)?.resultCents ?? 0,
            ),
          }))}
          formatter={(value) => formatCurrencyFromCents(value)}
          tone="amber"
        />
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Top despesas manuais</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Maiores lancamentos operacionais do periodo.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href="/dashboard/financeiro/despesas">Gerenciar despesas</a>
          </Button>
        </div>
        {report.topExpenses.length === 0 ? (
          <p className="mt-4 text-sm text-brand-gray-light">
            Nenhuma despesa manual registrada no periodo.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-gray-mid text-sm">
            {report.topExpenses.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-white">{expense.description}</p>
                  <p className="text-xs text-brand-gray-light">
                    {EXPENSE_CATEGORY_LABELS[expense.category]} -{" "}
                    {expense.incurredAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <span className="font-semibold text-white">
                  {formatCurrencyFromCents(expense.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
