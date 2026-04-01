import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/public/SectionHeading";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { BRAND } from "@/lib/constants/brand";
import { getStoreCatalogData } from "@/lib/store/catalog";
import { CATALOG_SORT_OPTIONS } from "@/lib/store/constants";
import { parseSearchParams } from "@/lib/validators";
import { catalogFiltersSchema } from "@/lib/validators/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Loja da Academia",
  description:
    "Catalogo publico da Maquina Team com equipamentos, acessorios e vestuario para treino.",
};

export const dynamic = "force-dynamic";

export default async function StorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    catalogFiltersSchema,
  );

  let storeUnavailable = false;
  const emptyCatalogData = {
    products: [],
    categories: [],
    summary: {
      totalProducts: 0,
      featuredProducts: 0,
      inStockProducts: 0,
    },
  };

  const data = await getStoreCatalogData(filters).catch((error) => {
    storeUnavailable = true;
    console.error("Falha ao carregar o catalogo publico da loja.", error);
    return emptyCatalogData;
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="rounded-[2.5rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
              Loja da academia
            </p>
            <h1 className="mt-4 text-4xl font-bold uppercase text-white sm:text-5xl">
              Equipamentos e acessorios
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-gray-light sm:text-base">
              Luvas, bandagens, caneleiras, camisetas e acessorios selecionados para
              a rotina de treino da Maquina Team, com uma vitrine clean, forte e
              integrada ao restante do sistema.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                  Catalogo
                </p>
                <p className="mt-3 text-3xl font-bold text-white">{data.summary.totalProducts}</p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                  Destaques
                </p>
                <p className="mt-3 text-3xl font-bold text-white">{data.summary.featuredProducts}</p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
                  Em estoque
                </p>
                <p className="mt-3 text-3xl font-bold text-white">{data.summary.inStockProducts}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-brand-gray-mid bg-brand-black/50 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-brand-gray-light">
              {storeUnavailable ? "Atendimento rapido" : "Compra integrada"}
            </p>
            <p className="mt-4 text-2xl font-bold uppercase text-white">
              {storeUnavailable
                ? "Catálogo em reconexao"
                : "Carrinho server-side, cupom, frete e pedidos"}
            </p>
            <p className="mt-4 text-sm leading-7 text-brand-gray-light">
              {storeUnavailable
                ? "A vitrine publica esta sendo restabelecida neste ambiente. Enquanto isso, voce ainda pode falar com a equipe para reservar equipamentos e acessorios."
                : "Monte o carrinho como visitante e finalize logado, com area do aluno, controle de estoque e pedidos conectados ao sistema interno."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {storeUnavailable ? (
                <>
                  <Button asChild className="w-full sm:w-auto">
                    <a
                      href={BRAND.contact.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar no WhatsApp
                    </a>
                  </Button>
                  <Button asChild variant="secondary" className="w-full sm:w-auto">
                    <Link href="/">Voltar ao inicio</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/carrinho">Abrir carrinho</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full sm:w-auto">
                    <Link href="/dashboard/pedidos">Meus pedidos</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))]">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Busque por nome, categoria ou descricao"
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          />
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          >
            <option value="">Todas as categorias</option>
            {data.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            name="priceMin"
            type="number"
            min="0"
            step="1"
            defaultValue={filters.priceMin ?? ""}
            placeholder="Preco min."
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          />
          <input
            name="priceMax"
            type="number"
            min="0"
            step="1"
            defaultValue={filters.priceMax ?? ""}
            placeholder="Preco max."
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          />
          <select
            name="availability"
            defaultValue={filters.availability}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          >
            <option value="all">Toda disponibilidade</option>
            <option value="in_stock">Somente em estoque</option>
            <option value="low_stock">Estoque baixo</option>
          </select>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            disabled={storeUnavailable}
          >
            {CATALOG_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={storeUnavailable}
            >
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/loja">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Catalogo"
          title="Compre seus produtos"
          description="Visual premium, checkout consistente e produtos escolhidos para a rotina de luta."
        />

        {storeUnavailable ? (
          <div className="mt-10">
            <EmptyState
              title="Catalogo temporariamente indisponivel"
              description="A pagina da loja continua no ar, mas o catalogo ainda nao conseguiu carregar neste ambiente. Assim que a conexao estabilizar, os produtos voltam a aparecer aqui."
              actionLabel="Voltar ao inicio"
              actionHref="/"
            />
          </div>
        ) : data.products.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Nenhum produto encontrado"
              description="Ajuste os filtros para localizar outros itens da loja."
              actionLabel="Limpar filtros"
              actionHref="/loja"
            />
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-3">
            {data.products.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
