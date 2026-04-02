import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ApplyCouponForm } from "@/components/store/ApplyCouponForm";
import { CartItemControls } from "@/components/store/CartItemControls";
import { Button } from "@/components/ui/Button";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { buildNoIndexMetadata } from "@/lib/seo";
import { getCartSnapshot } from "@/lib/store/cart";

export const metadata = buildNoIndexMetadata({
  title: "Carrinho",
  description:
    "Revise seus produtos, cupom e siga para o checkout da loja da Maquina Team.",
  path: "/carrinho",
});

export default async function CartPage() {
  const cart = await getCartSnapshot();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="Seu carrinho esta vazio"
          description="Explore a loja da academia e adicione os primeiros equipamentos ao pedido."
          actionLabel="Ir para a loja"
          actionHref="/products"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
              Carrinho
            </p>
            <h1 className="mt-3 text-3xl font-bold uppercase text-white sm:text-4xl">
              Revise seu pedido
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-gray-light">
              Ajuste quantidades e siga para um checkout rapido, com visual mais
              enxuto e direto.
            </p>
          </div>

          <div className="space-y-3">
            {cart.items.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-gray-dark p-4"
              >
                <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 sm:grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[88px_minmax(0,1fr)_auto] lg:items-center">
                  <div className="overflow-hidden rounded-xl border border-brand-gray-mid bg-brand-black">
                    {item.product.image ? (
                      <Image
                        src={item.product.image.url}
                        alt={item.product.image.altText ?? item.product.name}
                        width={88}
                        height={88}
                        unoptimized
                        className="h-[76px] w-[76px] object-cover grayscale sm:h-[88px] sm:w-[88px]"
                      />
                    ) : (
                      <div className="flex h-[76px] w-[76px] items-center justify-center text-[10px] text-brand-gray-light sm:h-[88px] sm:w-[88px]">
                        Sem imagem
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="space-y-2">
                      <h2 className="line-clamp-2 text-sm font-bold uppercase leading-5 text-white sm:text-base">
                        {item.product.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="info">{item.product.category}</StatusBadge>
                        {!item.available ? (
                          <StatusBadge tone="danger">Indisponivel</StatusBadge>
                        ) : item.product.isLowStock ? (
                          <StatusBadge tone="warning">Estoque baixo</StatusBadge>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gray-light sm:text-xs">
                      {formatCurrencyFromCents(item.product.priceCents)} por unidade
                    </p>

                    <CartItemControls
                      itemId={item.id}
                      quantity={item.quantity}
                      maxQuantity={item.product.trackInventory ? item.product.stockQuantity : null}
                    />
                  </div>

                  <div className="col-span-full border-t border-brand-gray-mid pt-3 lg:col-span-1 lg:border-t-0 lg:pt-0 lg:text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-brand-gray-light">
                      Total do item
                    </p>
                    <p className="mt-1 text-xl font-bold text-white sm:text-2xl">
                      {formatCurrencyFromCents(item.lineTotalCents)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-gray-dark p-4">
            <h2 className="text-xl font-bold uppercase text-white">Resumo</h2>
            <div className="mt-4 space-y-3 text-sm text-brand-gray-light">
              <div className="flex items-center justify-between">
                <span>Itens</span>
                <strong className="text-white">{cart.summary.itemCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <strong className="text-white">
                  {formatCurrencyFromCents(cart.summary.subtotalCents)}
                </strong>
              </div>
            </div>

            <div className="mt-5 border-t border-brand-gray-mid pt-5">
              <ApplyCouponForm />
            </div>

            <div className="mt-5 space-y-3">
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout">Ir para o checkout</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link href="/products">Continuar comprando</Link>
              </Button>
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}
