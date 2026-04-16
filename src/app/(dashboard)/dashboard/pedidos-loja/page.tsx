import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { formatDate } from "@/lib/academy/constants";
import { requirePermission } from "@/lib/auth/guards";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { getAdminOrdersData } from "@/lib/store/orders";
import {
  getOrderStatusLabel,
  getOrderStatusTone,
  getPaymentStatusLabel,
  getPaymentStatusTone,
} from "@/lib/store/constants";
import { parseSearchParams } from "@/lib/validators";
import { orderFiltersSchema } from "@/lib/validators/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Pedidos da loja",
  description: "Operacao de pedidos, status e acompanhamento do e-commerce interno.",
};

export default async function StoreOrdersAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("manageStoreOrders", "/dashboard/pedidos-loja");
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    orderFiltersSchema,
  );
  const data = await getAdminOrdersData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Loja"
        title="Pedidos do e-commerce"
        description="Acompanhe os pedidos da loja, cuide do fluxo de separacao, entrega e conciliacao de pagamento."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Numero, cliente ou e-mail"
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="all">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PAID">Pago</option>
            <option value="PROCESSING">Em separacao</option>
            <option value="SHIPPED">Enviado</option>
            <option value="DELIVERED">Entregue</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/pedidos-loja">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          description="Os novos pedidos da loja aparecerao aqui assim que os checkouts forem concluídos."
        />
      ) : (
        <>
        <section className="space-y-4">
          {data.orders.map((order) => (
            <article
              key={order.id}
              className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{order.orderNumber}</h2>
                    <StatusBadge tone={getOrderStatusTone(order.status)}>
                      {getOrderStatusLabel(order.status)}
                    </StatusBadge>
                    <StatusBadge tone={getPaymentStatusTone(order.paymentStatus)}>
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {order.customerName} • {formatDate(order.placedAt)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/pedidos-loja/${order.id}`}>Operar pedido</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Total
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {formatCurrencyFromCents(order.totalCents)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Entrega
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{order.deliveryLabel}</p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Mix rapido
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {order.items
                      .map((item) => `${item.productName} x${item.quantity}`)
                      .join(" • ")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <PaginationControls
          pathname="/dashboard/pedidos-loja"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
