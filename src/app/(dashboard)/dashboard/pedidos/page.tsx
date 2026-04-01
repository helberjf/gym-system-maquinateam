import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { formatDate } from "@/lib/academy/constants";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { getMyOrdersData } from "@/lib/store/orders";
import {
  getDeliveryMethodLabel,
  getOrderStatusLabel,
  getOrderStatusTone,
  getPaymentStatusLabel,
  getPaymentStatusTone,
} from "@/lib/store/constants";
import { parseSearchParams } from "@/lib/validators";
import { orderFiltersSchema } from "@/lib/validators/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Meus pedidos",
  description: "Historico de compras, acompanhamento de status e detalhes da loja.",
};

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewStoreOrders", "/dashboard/pedidos");
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    orderFiltersSchema,
  );
  const orders = await getMyOrdersData(session.user.id, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Loja"
        title="Meus pedidos"
        description="Acompanhe suas compras, status de entrega e historico de pedidos feitos na loja da academia."
        action={
          <Button asChild variant="secondary">
            <Link href="/products">Voltar para a loja</Link>
          </Button>
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Numero do pedido ou produto"
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
              <Link href="/dashboard/pedidos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          description="Suas compras da loja aparecerao aqui assim que voce concluir o checkout."
          actionLabel="Ir para a loja"
          actionHref="/products"
        />
      ) : (
        <section className="space-y-4">
          {orders.map((order) => (
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
                    {getDeliveryMethodLabel(order.deliveryMethod)} • {formatDate(order.placedAt)}
                  </p>
                </div>

                <Button asChild variant="secondary">
                  <Link href={`/dashboard/pedidos/${order.id}`}>Ver detalhes</Link>
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
                    Itens
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {order.items.reduce((total, item) => total + item.quantity, 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                    Mix rapido
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {order.items
                      .slice(0, 2)
                      .map((item) => `${item.productName} x${item.quantity}`)
                      .join(" • ")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
