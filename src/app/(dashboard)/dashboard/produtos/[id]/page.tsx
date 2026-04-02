import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ApiActionButton } from "@/components/dashboard/ApiActionButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate } from "@/lib/academy/constants";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  getProductStatusLabel,
  getSaleStatusLabel,
  isLowStockProduct,
} from "@/lib/commerce/constants";
import {
  getProductStatusTone,
  getSaleStatusTone,
  getStockHealthTone,
} from "@/lib/commerce/presentation";
import { getProductDetailData } from "@/lib/commerce/service";
import { hasPermission } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Detalhes do produto",
  description: "Estoque, imagens, historico de venda e configuracao do produto.",
};

type RouteParams = Promise<{ id: string }>;

export default async function ProductDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission("viewProducts", "/dashboard/produtos");
  const viewer = await getViewerContextFromSession(session);
  const { id } = await params;
  const data = await getProductDetailData(viewer, id);
  const { product } = data;
  const lowStock = isLowStockProduct({
    trackInventory: product.trackInventory,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    status: product.status,
  });
  const canViewSales = hasPermission(session.user.role, "viewSales");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Produto"
        title={product.name}
        description={`SKU ${product.sku} • categoria ${product.category}.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/produtos">Voltar para produtos</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getProductStatusTone(product.status)}>
              {getProductStatusLabel(product.status)}
            </StatusBadge>
            <StatusBadge tone="info">{product.category}</StatusBadge>
            {product.storeVisible ? (
              <StatusBadge tone="success">Vitrine publica</StatusBadge>
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

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-brand-gray-mid bg-brand-black">
                {product.images[0] ? (
                  <Image
                    src={product.images[0].url}
                    alt={product.images[0].altText ?? product.name}
                    width={1200}
                    height={900}
                    unoptimized
                    className="aspect-[4/3] w-full object-cover sm:h-80 sm:aspect-auto"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-sm text-brand-gray-light sm:h-80 sm:aspect-auto">
                    Sem imagem principal
                  </div>
                )}
              </div>

              {product.images.length > 1 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {product.images.slice(1).map((image) => (
                    <div
                      key={image.id}
                      className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black"
                    >
                      <Image
                        src={image.url}
                        alt={image.altText ?? product.name}
                        width={320}
                        height={224}
                        unoptimized
                        className="aspect-[4/3] w-full object-cover md:h-28 md:aspect-auto"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Preco</p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatCurrencyFromCents(product.priceCents)}
                </p>
              </div>

              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Estoque</p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {product.trackInventory ? product.stockQuantity : "Nao controlado"}
                </p>
                {product.trackInventory ? (
                  <p className="mt-1 text-xs text-brand-gray-light">
                    Limite de alerta: {product.lowStockThreshold}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Historico
                </p>
                <p className="mt-3 text-sm text-white">
                  {product._count.saleItems} item(ns) vendidos
                </p>
                <p className="mt-1 text-xs text-brand-gray-light">
                  Atualizado em {formatDate(product.updatedAt)}
                </p>
              </div>

              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Logistica
                </p>
                <p className="mt-3 text-sm text-white">
                  {product.weightGrams ? `${product.weightGrams} g` : "Peso nao informado"}
                </p>
                <p className="mt-1 text-xs text-brand-gray-light">
                  {product.heightCm && product.widthCm && product.lengthCm
                    ? `${product.heightCm} x ${product.widthCm} x ${product.lengthCm} cm`
                    : "Dimensoes nao informadas"}
                </p>
              </div>
            </div>
          </div>

          {product.shortDescription ? (
            <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Descricao curta
              </p>
              <p className="mt-3 text-sm text-white">{product.shortDescription}</p>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Descricao</p>
            <p className="mt-3 text-sm text-white">
              {product.description ?? "Sem descricao complementar cadastrada."}
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Acoes rapidas</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-sm text-brand-gray-light">
                Produtos inativos saem do fluxo de venda, mas permanecem no historico.
              </p>
            </div>
            {data.canManage && product.status !== "ARCHIVED" ? (
              <ApiActionButton
                endpoint={`/api/products/${product.id}`}
                method="DELETE"
                label="Inativar produto"
                loadingLabel="Inativando..."
                variant="danger"
                confirmMessage="Deseja realmente inativar este produto?"
              />
            ) : null}
          </div>
        </article>
      </section>

      {data.canManage ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Editar produto</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            Ajuste estoque, categoria, imagens e disponibilidade do item.
          </p>
          <div className="mt-6">
            <ProductForm
              mode="edit"
              endpoint={`/api/products/${product.id}`}
              initialValues={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                category: product.category,
                shortDescription: product.shortDescription ?? "",
                description: product.description ?? "",
                price: (product.priceCents / 100).toFixed(2),
                stockQuantity: String(product.stockQuantity),
                lowStockThreshold: String(product.lowStockThreshold),
                trackInventory: product.trackInventory,
                storeVisible: product.storeVisible,
                featured: product.featured,
                weightGrams: product.weightGrams ? String(product.weightGrams) : "",
                heightCm: product.heightCm ? String(product.heightCm) : "",
                widthCm: product.widthCm ? String(product.widthCm) : "",
                lengthCm: product.lengthCm ? String(product.lengthCm) : "",
                active: product.status !== "ARCHIVED",
                images: product.images.map((image) => ({
                  url: image.url,
                  storageKey: image.storageKey,
                  altText: image.altText ?? "",
                  isPrimary: image.isPrimary,
                })),
              }}
              options={{
                categories: data.options.categories,
              }}
            />
          </div>
        </section>
      ) : null}

      {canViewSales ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Historico recente de vendas</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Ultimas movimentacoes comerciais que envolveram este produto.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.recentSales.length} registro(s)</StatusBadge>
          </div>

          {data.recentSales.length === 0 ? (
            <p className="mt-6 text-sm text-brand-gray-light">
              Nenhuma venda registrada para este produto ate o momento.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {data.recentSales.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.productSale.saleNumber}
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {item.productSale.studentProfile?.user.name ??
                          item.productSale.customerName ??
                          "Venda de balcao"}{" "}
                        • {formatDate(item.productSale.soldAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={getSaleStatusTone(item.productSale.status)}>
                        {getSaleStatusLabel(item.productSale.status)}
                      </StatusBadge>
                      <StatusBadge tone="info">
                        {item.quantity} un • {formatCurrencyFromCents(item.lineTotalCents)}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
