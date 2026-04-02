import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StoreOrderStatusForm } from "@/components/store/StoreOrderStatusForm";
import { formatDate } from "@/lib/academy/constants";
import { requirePermission } from "@/lib/auth/guards";
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
  title: "Operar pedido",
  description: "Detalhe administrativo do pedido, itens, rastreio e atualizacao de status.",
};

type RouteParams = Promise<{ id: string }>;

export default async function StoreOrderAdminDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission("manageStoreOrders", "/dashboard/pedidos-loja");
  const { id } = await params;
  const order = await getOrderDetailForUser({
    orderId: id,
    userId: session.user.id,
    canManage: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao da loja"
        title={order.orderNumber}
        description={`Pedido criado em ${formatDate(order.placedAt)} por ${order.customerName}.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/pedidos-loja">Voltar para pedidos</Link>
          </Button>
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
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Cliente</p>
            <p className="mt-3 text-sm text-white">{order.customerName}</p>
            <p className="mt-1 text-xs text-brand-gray-light">
              {order.customerEmail} • {order.customerPhone}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Entrega</p>
            <p className="mt-3 text-sm text-white">
              {order.shippingStreet
                ? `${order.shippingStreet}, ${order.shippingNumber} - ${order.shippingDistrict}, ${order.shippingCity}/${order.shippingState}`
                : "Retirada presencial na academia"}
            </p>
            <p className="mt-1 text-xs text-brand-gray-light">
              {order.shippingRecipientName ?? order.customerName} •{" "}
              {order.shippingRecipientPhone ?? order.customerPhone}
            </p>
            {order.trackingCode ? (
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-gray-light">
                Rastreio: {order.trackingCode}
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Atualizar status</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            Use esta acao para separar, enviar, concluir ou cancelar o pedido.
          </p>
          <div className="mt-5">
            <StoreOrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              currentPaymentStatus={order.paymentStatus}
              trackingCode={order.trackingCode}
            />
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Itens do pedido</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Dados congelados no momento da compra para auditoria e conferencias.
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
                  <Image
                    src={item.productImageUrl}
                    alt={item.productName}
                    width={88}
                    height={80}
                    unoptimized
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
