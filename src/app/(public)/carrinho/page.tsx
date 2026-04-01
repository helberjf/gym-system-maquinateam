import Link from "next/link";
import { auth } from "@/auth";
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
  const session = await auth();
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
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
        <section className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
              Carrinho
            </p>
            <h1 className="mt-3 text-4xl font-bold uppercase text-white sm:text-5xl">
              Revise seu pedido
            </h1>
            <p className="mt-4 text-sm leading-7 text-brand-gray-light">
              Ajuste quantidades, valide cupom e siga para um checkout conectado ao
              seu painel da Maquina Team.
            </p>
          </div>

          <div className="space-y-4">
            {cart.items.map((item) => (
              <article
                key={item.id}
                className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_minmax(0,1fr)_auto]">
                  <div className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black">
                    {item.product.image ? (
                      <img
                        src={item.product.image.url}
                        alt={item.product.image.altText ?? item.product.name}
                        className="aspect-[4/3] w-full object-cover grayscale"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-xs text-brand-gray-light">
                        Sem imagem
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold uppercase text-white">
                        {item.product.name}
                      </h2>
                      <StatusBadge tone="info">{item.product.category}</StatusBadge>
                      {!item.available ? (
                        <StatusBadge tone="danger">Indisponivel</StatusBadge>
                      ) : item.product.isLowStock ? (
                        <StatusBadge tone="warning">Estoque baixo</StatusBadge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6 text-brand-gray-light">
                      {item.product.shortDescription ??
                        "Produto selecionado para o seu treino e compra dentro da academia."}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-gray-light">
                      {formatCurrencyFromCents(item.product.priceCents)} por unidade
                    </p>
                    <CartItemControls
                      itemId={item.id}
                      quantity={item.quantity}
                      maxQuantity={item.product.trackInventory ? item.product.stockQuantity : null}
                    />
                  </div>

                  <div className="md:text-right">
                    <p className="text-xs uppercase tracking-[0.22em] text-brand-gray-light">
                      Total do item
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {formatCurrencyFromCents(item.lineTotalCents)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
            <h2 className="text-xl font-bold uppercase text-white">Resumo</h2>
            <div className="mt-5 space-y-3 text-sm text-brand-gray-light">
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

            <div className="mt-6 border-t border-brand-gray-mid pt-6">
              <ApplyCouponForm />
            </div>

            <div className="mt-6 space-y-3">
              <Button asChild size="lg" className="w-full">
                <Link href={session?.user?.id ? "/checkout" : "/login?callbackUrl=%2Fcheckout"}>
                  {session?.user?.id ? "Ir para o checkout" : "Entrar para finalizar"}
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link href="/products">Continuar comprando</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-brand-gray-mid bg-white p-5 text-black">
            <p className="text-xs uppercase tracking-[0.28em] text-black/55">
              Compra conectada
            </p>
            <p className="mt-4 text-2xl font-bold uppercase">
              Checkout protegido e area do cliente
            </p>
            <p className="mt-3 text-sm leading-7 text-black/70">
              O pedido nasce no servidor, com estoque validado, cupom conferido,
              frete recalculado e historico direto no dashboard.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
