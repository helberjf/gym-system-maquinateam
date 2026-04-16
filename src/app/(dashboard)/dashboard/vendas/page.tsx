import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate } from "@/lib/academy/constants";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  getPaymentMethodLabel,
  getSaleStatusLabel,
  SALE_FILTER_STATUS_OPTIONS,
} from "@/lib/commerce/constants";
import { getSaleStatusTone } from "@/lib/commerce/presentation";
import { getProductSalesIndexData } from "@/lib/commerce/service";
import { parseSearchParams, saleFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Vendas",
  description: "Historico de vendas internas, itens vendidos e impacto no estoque.",
};

export default async function ProductSalesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewSales", "/dashboard/vendas");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    saleFiltersSchema,
  );
  const data = await getProductSalesIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Vendas internas"
        description="Registre vendas de balcao, acompanhe historico por aluno e monitore o impacto no estoque da academia."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/vendas/nova">Nova venda</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Vendas"
          value={data.summary.totalSales}
          note="Total filtrado no periodo atual."
        />
        <MetricCard
          label="Pagas"
          value={data.summary.paidSales}
          note="Movimentaram estoque automaticamente."
        />
        <MetricCard
          label="Pendentes"
          value={data.summary.pendingSales}
          note="Aguardando fechamento definitivo."
        />
        <MetricCard
          label="Receita"
          value={formatCurrencyFromCents(data.summary.revenueCents)}
          note={`${data.summary.totalItems} item(ns) vendidos no recorte.`}
        />
      </section>

      {data.summary.lowStockProducts > 0 ? (
        <section className="rounded-2xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Reposicao recomendada</h2>
          <p className="mt-2 text-sm text-brand-gray-light">
            Existem {data.summary.lowStockProducts} produto(s) em alerta de estoque baixo depois das ultimas vendas.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            name="search"
            placeholder="Numero, cliente, aluno ou produto"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
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
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            {SALE_FILTER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/vendas">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.sales.length === 0 ? (
        <EmptyState
          title="Nenhuma venda encontrada"
          description="Registre uma nova venda ou ajuste os filtros para localizar movimentacoes existentes."
          actionLabel={data.canManage ? "Registrar venda" : undefined}
          actionHref={data.canManage ? "/dashboard/vendas/nova" : undefined}
        />
      ) : (
        <>
        <section className="space-y-4">
          {data.sales.map((sale) => (
            <article
              key={sale.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{sale.saleNumber}</h2>
                    <StatusBadge tone={getSaleStatusTone(sale.status)}>
                      {getSaleStatusLabel(sale.status)}
                    </StatusBadge>
                    <StatusBadge tone="info">
                      {getPaymentMethodLabel(sale.paymentMethod)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {sale.studentProfile?.user.name ??
                      sale.customerName ??
                      "Venda de balcao sem cliente identificado"}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Registrada por {sale.soldByUser.name} em {formatDate(sale.soldAt)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/vendas/${sale.id}`}>Ver detalhes</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Total
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {formatCurrencyFromCents(sale.totalCents)}
                  </p>
                  {sale.discountCents > 0 ? (
                    <p className="mt-1 text-xs text-brand-gray-light">
                      Desconto {formatCurrencyFromCents(sale.discountCents)}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Itens
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {sale.items.reduce((total, item) => total + item.quantity, 0)}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-light">
                    {sale.items.length} produto(s) diferentes
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Mix rapido
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {sale.items
                      .slice(0, 2)
                      .map((item) => `${item.product.name} x${item.quantity}`)
                      .join(" • ")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/vendas"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
