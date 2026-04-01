import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketPercent, Truck } from "lucide-react";
import { AddToCartButton } from "@/components/store/AddToCartButton";
import { StoreFavoriteButton } from "@/components/store/StoreFavoriteButton";
import { StoreProductGallery } from "@/components/store/StoreProductGallery";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { SectionHeading } from "@/components/public/SectionHeading";
import { Button } from "@/components/ui/Button";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { BRAND } from "@/lib/constants/brand";
import {
  absoluteUrl,
  buildNoIndexMetadata,
  buildPublicMetadata,
  serializeJsonLd,
} from "@/lib/seo";
import { getStoreProductDetail } from "@/lib/store/catalog";
import { getStoreFavoriteProductIds } from "@/lib/store/favorites";

type RouteParams = Promise<{ slug: string }>;

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const data = await getStoreProductDetail(slug);

    return buildPublicMetadata({
      title: data.product.name,
      description:
        data.product.shortDescription ??
        "Produto da Maquina Team disponivel para compra no catalogo da academia.",
      path: `/products/${data.product.slug}`,
      keywords: [
        data.product.category.toLowerCase(),
        data.product.sku.toLowerCase(),
        "produto para treino",
      ],
      images: data.product.images.map((image) => image.url),
    });
  } catch {
    return buildNoIndexMetadata({
      title: "Produto indisponivel",
      description: "O produto procurado nao foi encontrado no catalogo da Maquina Team.",
      path: "/products",
    });
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  try {
    const { slug } = await params;
    const [data, favoriteIds] = await Promise.all([
      getStoreProductDetail(slug),
      getStoreFavoriteProductIds(),
    ]);
    const favoriteIdSet = new Set(favoriteIds);
    const soldOut = data.product.trackInventory && data.product.stockQuantity <= 0;
    const interactiveEnabled = data.source === "live";
    const productUrl = absoluteUrl(`/products/${data.product.slug}`);
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: data.product.name,
      description:
        data.product.shortDescription ??
        data.product.description ??
        "Produto da Maquina Team para treino e rotina esportiva.",
      sku: data.product.sku,
      category: data.product.category,
      image: data.product.images.map((image) => absoluteUrl(image.url)),
      url: productUrl,
      brand: {
        "@type": "Brand",
        name: BRAND.name,
      },
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "BRL",
        price: (data.product.priceCents / 100).toFixed(2),
        availability: soldOut
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: BRAND.name,
        },
      },
    };
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Produtos",
          item: absoluteUrl("/products"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: data.product.name,
          item: productUrl,
        },
      ],
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(productSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbSchema),
          }}
        />
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-brand-gray-light">
            <Link href="/products" className="hover:text-white">
              Produtos
            </Link>
            <span>/</span>
            <span>{data.product.category}</span>
          </div>

          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <StoreProductGallery
                productName={data.product.name}
                images={data.product.images}
              />
            </div>

            <div className="rounded-[2.25rem] border border-neutral-200 bg-neutral-50 p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                    {data.product.category}
                  </span>
                  {data.product.featured ? (
                    <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                      Destaque
                    </span>
                  ) : null}
                  {soldOut ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">
                      Esgotado
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StoreFavoriteButton
                    productId={data.product.id}
                    productName={data.product.name}
                    initialIsFavorite={favoriteIdSet.has(data.product.id)}
                    variant="inline"
                    disabled={!interactiveEnabled}
                  />
                  <Button
                    asChild
                    variant="secondary"
                    className="border-neutral-300 text-neutral-900 hover:bg-neutral-100"
                  >
                    <Link href="/carrinho">Carrinho</Link>
                  </Button>
                </div>
              </div>

              <h1 className="mt-5 text-4xl font-semibold text-neutral-950 sm:text-5xl">
                {data.product.name}
              </h1>
              <p className="mt-4 text-base leading-8 text-neutral-600">
                {data.product.shortDescription ??
                  "Produto selecionado para a rotina de treino, compra e reposicao dentro da Maquina Team."}
              </p>

              <div className="mt-6 rounded-[1.75rem] border border-neutral-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Preco
                    </p>
                    <p className="mt-2 text-4xl font-semibold text-neutral-950">
                      {formatCurrencyFromCents(data.product.priceCents)}
                    </p>
                  </div>
                  <div className="text-sm text-neutral-600 sm:text-right">
                    <p>SKU {data.product.sku}</p>
                    <p className="mt-1">
                      {data.product.trackInventory
                        ? `${data.product.stockQuantity} unidade(s) em estoque`
                        : "Estoque sob consulta"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {interactiveEnabled ? (
                    <AddToCartButton
                      productId={data.product.id}
                      className="w-full"
                      label={soldOut ? "Produto indisponivel" : "Adicionar ao carrinho"}
                      disabled={soldOut}
                    />
                  ) : (
                    <div className="inline-flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-500">
                      Compra online volta com o banco
                    </div>
                  )}
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full border-neutral-300 text-neutral-900 hover:bg-neutral-100"
                  >
                    <Link href="/products">Continuar comprando</Link>
                  </Button>
                </div>
              </div>

              {data.source === "fallback" ? (
                <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                    Modo vitrine
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Este produto esta aparecendo pela vitrine de contingencia. Assim
                    que a conexao do catalogo principal estabilizar, favoritos,
                    carrinho e checkout voltam a operar daqui normalmente.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 rounded-[1.75rem] border border-neutral-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
                  Descricao completa
                </p>
                <p className="mt-4 text-sm leading-7 text-neutral-600">
                  {data.product.description ??
                    "Produto com curadoria da academia para treinos, rotina tecnica e reposicao de equipamento no dia a dia."}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Peso
                  </p>
                  <p className="mt-3 text-xl font-semibold text-neutral-950">
                    {data.product.weightGrams
                      ? `${data.product.weightGrams} g`
                      : "Nao informado"}
                  </p>
                </article>
                <article className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Dimensoes
                  </p>
                  <p className="mt-3 text-xl font-semibold text-neutral-950">
                    {data.product.heightCm &&
                    data.product.widthCm &&
                    data.product.lengthCm
                      ? `${data.product.heightCm} x ${data.product.widthCm} x ${data.product.lengthCm} cm`
                      : "Nao informado"}
                  </p>
                </article>
                <article className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Entrega
                  </p>
                  <p className="mt-3 text-xl font-semibold text-neutral-950">
                    Pickup, local ou envio
                  </p>
                </article>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <article className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    <TicketPercent className="h-4 w-4" />
                    Cupom
                  </div>
                  <p className="mt-3 text-lg font-semibold text-neutral-950">
                    BEMVINDO10
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Aplique no carrinho para desconto de boas-vindas na primeira
                    compra elegivel.
                  </p>
                </article>
                <article className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    <Truck className="h-4 w-4" />
                    Frete
                  </div>
                  <p className="mt-3 text-lg font-semibold text-neutral-950">
                    Checkout com escolha de entrega
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Retirada na academia, entrega local e envio padrao com
                    composicao no total do pedido.
                  </p>
                </article>
              </div>
            </div>
          </section>

          {data.relatedProducts.length > 0 ? (
            <section className="mt-16">
              <SectionHeading
                eyebrow="Relacionados"
                title="Outros produtos da mesma linha"
                description="Continue montando seu kit com itens da mesma categoria."
              />
              <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {data.relatedProducts.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    initialIsFavorite={favoriteIdSet.has(product.id)}
                    interactiveEnabled={data.source === "live"}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </>
    );
  } catch {
    notFound();
  }
}
