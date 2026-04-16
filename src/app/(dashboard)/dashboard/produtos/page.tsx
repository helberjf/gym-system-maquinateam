import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  getProductStatusLabel,
  isLowStockProduct,
  PRODUCT_FILTER_STATUS_OPTIONS,
} from "@/lib/commerce/constants";
import { getProductStatusTone, getStockHealthTone } from "@/lib/commerce/presentation";
import { getProductsIndexData } from "@/lib/commerce/service";
import { parseSearchParams, productFiltersSchema } from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Produtos",
  description: "Catalogo interno, estoque e alertas de produtos da academia.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewProducts", "/dashboard/produtos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    productFiltersSchema,
  );
  const data = await getProductsIndexData(viewer, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Produtos e estoque"
        description="Organize o catalogo interno da academia, acompanhe os itens com estoque baixo e mantenha o time de recepcao pronto para vender no balcao."
        action={
          data.canManage ? (
            <Button asChild>
              <Link href="/dashboard/produtos/novo">Novo produto</Link>
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Produtos"
          value={data.summary.totalProducts}
          note="Total visivel para o seu perfil."
        />
        <MetricCard
          label="Ativos"
          value={data.summary.activeProducts}
          note="Disponiveis para novas vendas."
        />
        <MetricCard
          label="Estoque baixo"
          value={data.summary.lowStockProducts}
          note="Itens abaixo do limite configurado."
        />
        <MetricCard
          label="Valor em estoque"
          value={formatCurrencyFromCents(data.summary.inventoryValueCents)}
          note="Estimativa baseada no preco atual cadastrado."
        />
      </section>

      {data.summary.lowStockProducts > 0 ? (
        <section className="rounded-2xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Alerta de estoque baixo</h2>
          <p className="mt-2 text-sm text-brand-gray-light">
            Existem {data.summary.lowStockProducts} produto(s) pedindo reposicao ou atencao da recepcao.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            name="search"
            placeholder="Nome, SKU, categoria ou descricao"
            defaultValue={filters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as categorias</option>
            {data.options.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            {PRODUCT_FILTER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/produtos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      {data.products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Ajuste os filtros ou cadastre um novo item para abastecer o catalogo interno."
          actionLabel={data.canManage ? "Criar produto" : undefined}
          actionHref={data.canManage ? "/dashboard/produtos/novo" : undefined}
        />
      ) : (
        <>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.products.map((product) => {
            const lowStock = isLowStockProduct({
              trackInventory: product.trackInventory,
              stockQuantity: product.stockQuantity,
              lowStockThreshold: product.lowStockThreshold,
              status: product.status,
            });

            return (
              <article
                key={product.id}
                className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black md:h-28 md:w-32 md:shrink-0 md:aspect-auto">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.images[0].altText ?? product.name}
                        width={128}
                        height={112}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-brand-gray-light">
                        Sem imagem
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{product.name}</h2>
                      <StatusBadge tone={getProductStatusTone(product.status)}>
                        {getProductStatusLabel(product.status)}
                      </StatusBadge>
                      <StatusBadge tone="info">{product.category}</StatusBadge>
                      {product.storeVisible ? (
                        <StatusBadge tone="success">Na loja</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Somente interno</StatusBadge>
                      )}
                      {product.featured ? <StatusBadge tone="info">Destaque</StatusBadge> : null}
                      {lowStock ? (
                        <StatusBadge tone={getStockHealthTone(product)}>
                          Estoque baixo
                        </StatusBadge>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm text-brand-gray-light">
                      {product.shortDescription ??
                        product.description ??
                        "Sem descricao complementar cadastrada."}
                    </p>
                    <p className="mt-2 text-xs text-brand-gray-light">
                      SKU {product.sku} • {product._count.saleItems} item(ns) vendidos no historico
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                          Preco
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">
                          {formatCurrencyFromCents(product.priceCents)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                          Estoque
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">
                          {product.trackInventory ? product.stockQuantity : "Nao controlado"}
                        </p>
                        {product.trackInventory ? (
                          <p className="mt-1 text-xs text-brand-gray-light">
                            Alerta a partir de {product.lowStockThreshold}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                          Valor estimado
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">
                          {product.trackInventory
                            ? formatCurrencyFromCents(product.priceCents * product.stockQuantity)
                            : "Sem controle"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:self-start">
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/produtos/${product.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <PaginationControls
          pathname="/dashboard/produtos"
          pagination={data.pagination}
          searchParams={rawSearchParams}
        />
        </>
      )}
    </div>
  );
}
