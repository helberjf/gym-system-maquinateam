import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate } from "@/lib/academy/constants";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  getPaymentMethodLabel,
  getSaleStatusLabel,
} from "@/lib/commerce/constants";
import { getSaleStatusTone } from "@/lib/commerce/presentation";
import { getProductSaleDetailData } from "@/lib/commerce/service";

export const metadata: Metadata = {
  title: "Detalhes da venda",
  description: "Itens vendidos, vendedor responsavel e impacto financeiro da venda interna.",
};

type RouteParams = Promise<{ id: string }>;

export default async function ProductSaleDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission("viewSales", "/dashboard/vendas");
  const viewer = await getViewerContextFromSession(session);
  const { id } = await params;
  const data = await getProductSaleDetailData(viewer, id);
  const { sale } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Venda"
        title={sale.saleNumber}
        description={`Registrada em ${formatDate(sale.soldAt)} por ${sale.soldByUser.name}.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/vendas">Voltar para vendas</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getSaleStatusTone(sale.status)}>
              {getSaleStatusLabel(sale.status)}
            </StatusBadge>
            <StatusBadge tone="info">
              {getPaymentMethodLabel(sale.paymentMethod)}
            </StatusBadge>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Subtotal</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(sale.subtotalCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Desconto</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(sale.discountCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Total</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(sale.totalCents)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Cliente</p>
            <p className="mt-3 text-sm text-white">
              {sale.studentProfile?.user.name ?? sale.customerName ?? "Venda de balcao sem cliente identificado"}
            </p>
            <p className="mt-1 text-xs text-brand-gray-light">
              {sale.studentProfile
                ? `${sale.studentProfile.registrationNumber} • ${sale.studentProfile.user.email}`
                : sale.customerDocument ?? "Sem documento informado"}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Observacoes</p>
            <p className="mt-3 text-sm text-white">
              {sale.notes ?? "Sem observacoes registradas para esta venda."}
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Responsavel</h2>
          <div className="mt-4 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-sm font-semibold text-white">{sale.soldByUser.name}</p>
            <p className="mt-1 text-xs text-brand-gray-light">{sale.soldByUser.email}</p>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Itens vendidos</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Snapshot da venda usado para historico, auditoria e conferencia de estoque.
            </p>
          </div>
          <StatusBadge tone="neutral">{sale.items.length} item(ns)</StatusBadge>
        </div>

        <div className="mt-6 space-y-3">
          {sale.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4 md:grid-cols-[88px_minmax(0,1fr)_auto]"
            >
              <div className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black">
                {item.product.images[0] ? (
                  <img
                    src={item.product.images[0].url}
                    alt={item.product.name}
                    className="aspect-[4/3] w-full object-cover md:h-20 md:w-[88px] md:aspect-auto"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-xs text-brand-gray-light md:h-20 md:w-[88px] md:aspect-auto">
                    Sem imagem
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{item.product.name}</p>
                <p className="mt-1 text-xs text-brand-gray-light">
                  {item.product.category} • SKU {item.product.sku}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <StatusBadge tone="info">
                  {item.quantity} un
                </StatusBadge>
                <StatusBadge tone="neutral">
                  {formatCurrencyFromCents(item.unitPriceCents)}
                </StatusBadge>
                <StatusBadge tone="success">
                  {formatCurrencyFromCents(item.lineTotalCents)}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
