import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { Button } from "@/components/ui/Button";
import { requireAuthenticatedSession } from "@/lib/permissions";
import { buildNoIndexMetadata } from "@/lib/seo";
import { getStoreWishlistSnapshot } from "@/lib/store/favorites";

export const metadata = buildNoIndexMetadata({
  title: "Favoritos",
  description: "Produtos salvos para acompanhar depois na loja da Maquina Team.",
  path: "/favoritos",
});

export default async function FavoritesPage() {
  await requireAuthenticatedSession("/favoritos");
  const wishlist = await getStoreWishlistSnapshot();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-[2.25rem] border border-neutral-200 bg-neutral-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
              Favoritos
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-neutral-950 sm:text-5xl">
              Seus produtos salvos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600 sm:text-base">
              Guarde os itens que chamaram sua atencao e volte para finalizar quando
              quiser. Carrinho e checkout seguem conectados ao sistema da academia.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="secondary" className="border-neutral-300 text-neutral-900 hover:bg-neutral-100">
              <Link href="/products">Continuar vendo produtos</Link>
            </Button>
            <Button asChild>
              <Link href="/carrinho">Abrir carrinho</Link>
            </Button>
          </div>
        </div>
      </div>

      {wishlist.products.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nenhum favorito salvo"
            description="Use o coracao nos produtos da loja para montar sua selecao favorita."
            actionLabel="Explorar catalogo"
            actionHref="/products"
          />
        </div>
      ) : (
        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {wishlist.products.map((product) => (
            <StoreProductCard
              key={product.id}
              product={product}
              initialIsFavorite
            />
          ))}
        </section>
      )}
    </div>
  );
}
