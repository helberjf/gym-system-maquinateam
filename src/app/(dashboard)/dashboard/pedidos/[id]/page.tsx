import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate } from "@/lib/academy/constants";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { getOrderDetailForUser } from "@/lib/store/orders";
import {
  getDeliveryMethodLabel,
  getOrderStatusLabel,
  getOrderStatusTone,
  getPaymentStatusLabel,
  getPaymentStatusTone,
} from "@/lib/store/constants";

export const metadata: Metadata = {
  title: "Detalhes do pedido",
  description: "Itens, status e dados de entrega do pedido da loja.",
};

type RouteParams = Promise<{ id: string }>;

export default async function MyOrderDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission("viewStoreOrders", "/dashboard/pedidos");
  const { id } = await params;
  const order = await getOrderDetailForUser({
    orderId: id,
    userId: session.user.id,
    canManage: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pedido"
        title={order.orderNumber}
        description={`Criado em ${formatDate(order.placedAt)} com ${order.items.length} item(ns).`}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {order.checkoutPayment?.status === "PENDING" &&
            order.checkoutPayment.checkoutUrl ? (
              <Button asChild>
                <a href={order.checkoutPayment.checkoutUrl}>Pagar agora</a>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/dashboard/pedidos">Voltar para meus pedidos</Link>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getOrderStatusTone(order.status)}>
              {getOrderStatusLabel(order.status)}
            </StatusBadge>
            <StatusBadge tone={getPaymentStatusTone(order.paymentStatus)}>
              {getPaymentStatusLabel(order.paymentStatus)}
            </StatusBadge>
            <StatusBadge tone="info">{getDeliveryMethodLabel(order.deliveryMethod)}</StatusBadge>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Subtotal</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(order.subtotalCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Desconto</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(order.discountCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Frete</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(order.shippingCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Total</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(order.totalCents)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Entrega</p>
            <p className="mt-3 text-sm text-white">
              {order.shippingRecipientName ?? order.customerName}
            </p>
            <p className="mt-1 text-xs text-brand-gray-light">
              {order.shippingStreet
                ? `${order.shippingStreet}, ${order.shippingNumber} - ${order.shippingDistrict}, ${order.shippingCity}/${order.shippingState}`
                : "Retirada presencial na academia"}
            </p>
            {order.trackingCode ? (
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-gray-light">
                Rastreio: {order.trackingCode}
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Historico</h2>
          <div className="mt-4 space-y-3">
            {order.statusHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {getOrderStatusLabel(entry.status)}
                </p>
                <p className="mt-1 text-xs text-brand-gray-light">
                  {formatDate(entry.createdAt)} • {entry.changedByUser?.name ?? "Sistema"}
                </p>
                {entry.note ? (
                  <p className="mt-2 text-sm text-brand-gray-light">{entry.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Itens do pedido</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Snapshot do catalogo no momento em que o checkout foi concluido.
            </p>
          </div>
          <StatusBadge tone="neutral">{order.items.length} item(ns)</StatusBadge>
        </div>

        <div className="mt-6 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4 md:grid-cols-[88px_minmax(0,1fr)_auto]"
            >
              <div className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black">
                {item.productImageUrl ? (
                  <img
                    src={item.productImageUrl}
                    alt={item.productName}
                    className="aspect-[4/3] w-full object-cover md:h-20 md:w-[88px] md:aspect-auto"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-xs text-brand-gray-light md:h-20 md:w-[88px] md:aspect-auto">
                    Sem imagem
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{item.productName}</p>
                <p className="mt-1 text-xs text-brand-gray-light">
                  {item.productCategory} • SKU {item.productSku}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <StatusBadge tone="info">{item.quantity} un</StatusBadge>
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
