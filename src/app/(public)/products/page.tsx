import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ProductsInfiniteGrid } from "@/components/store/ProductsInfiniteGrid";
import { Button } from "@/components/ui/Button";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { buildPublicMetadata, serializeJsonLd, absoluteUrl } from "@/lib/seo";
import {
  getStoreCatalogPageData,
  STORE_CATALOG_PAGE_SIZE,
} from "@/lib/store/catalog";
import { CATALOG_SORT_OPTIONS } from "@/lib/store/constants";
import { parseSearchParams } from "@/lib/validators";
import { catalogFiltersSchema } from "@/lib/validators/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = buildPublicMetadata({
  title: "Produtos para treino",
  description:
    "Equipamentos, vestuario e acessorios de luta selecionados pela Maquina Team para treino, rotina e performance.",
  path: "/products",
  keywords: [
    "loja de luta",
    "equipamentos de boxe",
    "acessorios de muay thai",
    "vestuario para treino",
  ],
});

export const revalidate = 120;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    catalogFiltersSchema,
  );

  const data = await getStoreCatalogPageData(filters, {
    page: 1,
    limit: STORE_CATALOG_PAGE_SIZE,
  });
  const fallbackMode = data.source === "fallback";
  const productsSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Produtos Maquina Team",
    url: absoluteUrl("/products"),
    description:
      "Catalogo de produtos para treino, performance e rotina esportiva da Maquina Team.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: data.products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/products/${product.slug}`),
        name: product.name,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productsSchema),
        }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-white sm:text-4xl">Produtos</h1>
            <p className="text-sm text-brand-gray-light">
              {data.summary.totalProducts} produto(s) disponivel(is)
            </p>
          </div>

          <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
            <Link href="/">Voltar para a home</Link>
          </Button>
        </div>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Buscar produtos..."
              className="w-full rounded-xl border border-brand-gray-mid bg-brand-gray-dark py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-brand-gray-light focus:border-white"
            />
          </div>

          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-gray-dark px-4 py-2.5 text-sm text-white outline-none transition focus:border-white"
          >
            <option value="">Todas as categorias</option>
            {data.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            name="sort"
            defaultValue={filters.sort}
            className="rounded-xl border border-brand-gray-mid bg-brand-gray-dark px-4 py-2.5 text-sm text-white outline-none transition focus:border-white"
          >
            {CATALOG_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm">
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/products">Limpar</Link>
            </Button>
          </div>
        </form>

        {fallbackMode ? (
          <div className="mt-4 rounded-xl border border-amber-200/30 bg-amber-900/20 p-3">
            <p className="text-xs text-amber-200">
              Modo vitrine ativo e catalogo exibindo produtos de demonstracao.
            </p>
          </div>
        ) : null}

        {data.products.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Nenhum produto encontrado"
              description="Ajuste os filtros para localizar outros itens."
              actionLabel="Limpar filtros"
              actionHref="/products"
            />
          </div>
        ) : (
          <ProductsInfiniteGrid
            initialProducts={data.products}
            initialFavoriteIds={[]}
            filters={filters}
            initialPagination={data.pagination}
            interactiveEnabled={!fallbackMode}
          />
        )}
      </div>
    </>
  );
}
