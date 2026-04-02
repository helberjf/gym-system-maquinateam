"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { isLowStockProduct } from "@/lib/commerce/constants";
import type { StoreCatalogProductCard } from "@/lib/store/catalog";
import { Button } from "@/components/ui/Button";
import { AddToCartButton } from "@/components/store/AddToCartButton";
import { StoreFavoriteButton } from "@/components/store/StoreFavoriteButton";

type StoreProductCardProps = {
  product: StoreCatalogProductCard;
  initialIsFavorite?: boolean;
  interactiveEnabled?: boolean;
};

export function StoreProductCard({
  product,
  initialIsFavorite = false,
  interactiveEnabled = true,
}: StoreProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images =
    product.images.length > 0
      ? product.images
      : [{ url: "/images/logo.jpg", altText: product.name, isPrimary: true }];
  const currentImage = images[currentImageIndex] ?? images[0];
  const lowStock = isLowStockProduct({
    trackInventory: product.trackInventory,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    status: product.status,
  });
  const soldOut = product.trackInventory && product.stockQuantity <= 0;

  function handlePreviousImage(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCurrentImageIndex((value) => (value === 0 ? images.length - 1 : value - 1));
  }

  function handleNextImage(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCurrentImageIndex((value) => (value === images.length - 1 ? 0 : value + 1));
  }

  return (
    <article className="group relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-neutral-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
      <div className="relative aspect-square overflow-hidden border-b border-neutral-200/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(245,245,245,0.92)_45%,rgba(229,229,229,0.88)_100%)]">
        <div className="absolute left-3 top-3 z-10 flex max-w-[70%] flex-wrap gap-2">
          <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-700 shadow-sm">
            {product.category}
          </span>
          {product.featured ? (
            <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
              Destaque
            </span>
          ) : null}
        </div>

        <Link href={`/products/${product.slug}`} className="block h-full">
          <Image
            src={currentImage.url}
            alt={currentImage.altText ?? product.name}
            width={640}
            height={640}
            unoptimized
            className="aspect-square h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.05]"
          />
        </Link>

        {interactiveEnabled ? (
          <StoreFavoriteButton
            productId={product.id}
            productName={product.name}
            initialIsFavorite={initialIsFavorite}
            className="right-3 top-3 z-10 h-9 w-9 border-white/80 bg-white/90 p-0 text-neutral-700 shadow-md hover:border-black hover:text-black"
          />
        ) : (
          <span className="absolute right-3 top-3 rounded-full border border-black/10 bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600 shadow-sm">
            Vitrine
          </span>
        )}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePreviousImage}
              className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-neutral-800 opacity-70 shadow-md transition hover:opacity-100"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-neutral-800 opacity-70 shadow-md transition hover:opacity-100"
              aria-label="Proxima imagem"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
              {currentImageIndex + 1}/{images.length}
            </div>
          </>
        ) : null}

        {soldOut ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700 shadow-sm">
            Esgotado
          </span>
        ) : lowStock ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 shadow-sm">
            Ultimas unidades
          </span>
        ) : null}

        {interactiveEnabled ? (
          <AddToCartButton
            productId={product.id}
            size="sm"
            label={<ShoppingCart className="h-3.5 w-3.5" />}
            className="absolute bottom-3 right-3 z-10 h-9 w-9 rounded-full border-0 bg-brand-red p-0 text-black shadow-[0_12px_28px_rgba(0,0,0,0.18)] hover:bg-brand-red-dark"
            disabled={soldOut}
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-h-[2.7rem]">
          <Link href={`/products/${product.slug}`}>
            <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-5 text-neutral-950 transition group-hover:text-neutral-700 sm:text-base">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="rounded-[1.15rem] border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Preco
          </p>
          <p className="mt-1 text-[1.35rem] font-semibold leading-none text-neutral-950 sm:text-[1.5rem]">
            {formatCurrencyFromCents(product.priceCents)}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-neutral-500">
            {soldOut
              ? "Sem estoque no momento."
              : lowStock
                ? "Restam poucas unidades disponiveis."
                : product.trackInventory
                  ? `${product.stockQuantity} unidade(s) prontas para envio.`
                  : "Estoque sob consulta."}
          </p>
        </div>

        <div className="mt-auto">
          {interactiveEnabled ? (
            <AddToCartButton
              productId={product.id}
              size="sm"
              className="w-full rounded-[1rem] text-sm font-semibold"
              label={soldOut ? "Indisponivel" : "Comprar agora"}
              redirectToCart
              disabled={soldOut}
            />
          ) : (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="w-full rounded-[1rem] border-neutral-300 text-sm text-neutral-900 hover:bg-neutral-100"
            >
              <Link href={`/products/${product.slug}`}>Ver produto</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
