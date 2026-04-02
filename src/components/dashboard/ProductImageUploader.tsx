"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { MAX_PRODUCT_IMAGES } from "@/lib/commerce/constants";
import {
  helperTextClassName,
  inputClassName,
  labelClassName,
} from "@/components/dashboard/styles";

export type ProductImageValue = {
  url: string;
  storageKey?: string | null;
  altText: string;
  isPrimary: boolean;
};

type ProductImageUploaderProps = {
  value: ProductImageValue[];
  onChange: (images: ProductImageValue[]) => void;
  disabled?: boolean;
};

function normalizeImages(images: ProductImageValue[]) {
  if (images.length === 0) {
    return images;
  }

  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return images.map((image, index) => ({
    ...image,
    isPrimary: index === resolvedPrimaryIndex,
  }));
}

export function ProductImageUploader({
  value,
  onChange,
  disabled = false,
}: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/uploads/product-images", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            images?: Array<{
              url: string;
              storageKey?: string | null;
            }>;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.images) {
        setError(payload?.error ?? "Nao foi possivel enviar as imagens.");
        return;
      }

      const nextImages = normalizeImages([
        ...value,
        ...payload.images
          .slice(0, Math.max(0, MAX_PRODUCT_IMAGES - value.length))
          .map((image, index) => ({
            url: image.url,
            storageKey: image.storageKey ?? null,
            altText: "",
            isPrimary: value.length === 0 && index === 0,
          })),
      ]);

      onChange(nextImages);
    } catch {
      setError("Nao foi possivel enviar as imagens.");
    } finally {
      setIsUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function updateImage(index: number, partial: Partial<ProductImageValue>) {
    const nextImages = normalizeImages(
      value.map((image, currentIndex) =>
        currentIndex === index
          ? {
              ...image,
              ...partial,
            }
          : {
              ...image,
              ...(partial.isPrimary ? { isPrimary: false } : {}),
            },
      ),
    );

    onChange(nextImages);
  }

  function removeImage(index: number) {
    onChange(normalizeImages(value.filter((_, currentIndex) => currentIndex !== index)));
  }

  const remainingSlots = Math.max(0, MAX_PRODUCT_IMAGES - value.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className={labelClassName}>Imagens</p>
          <p className={helperTextClassName}>
            Envie ate {MAX_PRODUCT_IMAGES} imagens. A imagem principal aparece primeiro no catalogo interno.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-gray-light">
            {value.length}/{MAX_PRODUCT_IMAGES} imagem(ns)
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isUploading}
            disabled={disabled || remainingSlots === 0}
            onClick={() => inputRef.current?.click()}
          >
            {remainingSlots === 0 ? "Limite atingido" : "Enviar imagens"}
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        disabled={disabled || remainingSlots === 0}
        onChange={handleFilesSelected}
      />

      {value.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-gray-mid bg-brand-black/20 px-5 py-8 text-center text-sm text-brand-gray-light">
          Nenhuma imagem enviada ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {value.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-brand-gray-mid bg-brand-black/20 p-4 lg:grid-cols-[112px_minmax(0,1fr)_auto]"
            >
              <div className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black">
                <Image
                  src={image.url}
                  alt={image.altText || "Preview da imagem do produto"}
                  width={112}
                  height={84}
                  unoptimized
                  className="aspect-[4/3] w-full object-cover lg:h-28 lg:w-28 lg:aspect-auto"
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className={labelClassName}>Texto alternativo</label>
                  <input
                    value={image.altText}
                    onChange={(event) =>
                      updateImage(index, {
                        altText: event.target.value,
                      })
                    }
                    className={inputClassName}
                    disabled={disabled}
                    placeholder="Descreva rapidamente a imagem"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-brand-gray-mid bg-brand-black/40 px-4 py-3 text-sm text-white">
                  <input
                    type="radio"
                    name="primaryImage"
                    checked={image.isPrimary}
                    onChange={() => updateImage(index, { isPrimary: true })}
                    disabled={disabled}
                    className="h-4 w-4 accent-brand-red"
                  />
                  Definir como imagem principal
                </label>
              </div>

              <div className="flex items-start justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeImage(index)}
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-brand-gray-light/20 bg-brand-black/70 px-4 py-3 text-sm text-brand-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}
