"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StoreCatalogImage } from "@/lib/store/catalog";

type StoreProductGalleryProps = {
  productName: string;
  images: Array<StoreCatalogImage & { id?: string; isPrimary?: boolean }>;
};

export function StoreProductGallery({
  productName,
  images,
}: StoreProductGalleryProps) {
  const galleryImages =
    images.length > 0
      ? images
      : [
          {
            id: "placeholder",
            url: "/images/logo.jpg",
            altText: productName,
            isPrimary: true,
          },
        ];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentImage = galleryImages[selectedIndex] ?? galleryImages[0];

  function handlePrevious() {
    setSelectedIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1,
    );
  }

  function handleNext() {
    setSelectedIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1,
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
        <Image
          src={currentImage.url}
          alt={currentImage.altText ?? productName}
          width={960}
          height={960}
          unoptimized
          className="aspect-square w-full object-cover"
        />

        {galleryImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-sm transition hover:border-black hover:text-black"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-sm transition hover:border-black hover:text-black"
              aria-label="Proxima imagem"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      {galleryImages.length > 1 ? (
        <div className="grid grid-cols-4 gap-2">
          {galleryImages.map((image, index) => (
            <button
              key={image.id ?? `${image.url}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={[
                "overflow-hidden rounded-2xl border bg-white",
                index === selectedIndex ? "border-black" : "border-neutral-200",
              ].join(" ")}
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${productName} ${index + 1}`}
                width={240}
                height={240}
                unoptimized
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
