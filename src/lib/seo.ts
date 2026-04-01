import type { Metadata } from "next";
import { BRAND } from "@/lib/constants/brand";

const DEFAULT_SEO_IMAGE = "/images/fachada.webp";

const BASE_KEYWORDS = [
  "maquina team",
  "academia de luta",
  "academia em juiz de fora",
  "boxe",
  "muay thai",
  "kickboxing",
  "funcional",
  "loja de luta",
  "planos de academia",
] as const;

function normalizeBaseUrl(rawUrl: string) {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
}

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  return new URL(normalizeBaseUrl(rawUrl));
}

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return new URL(path, getSiteUrl()).toString();
}

function normalizePath(path: string) {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function mergeKeywords(keywords: string[] = []) {
  return Array.from(new Set([...BASE_KEYWORDS, ...keywords]));
}

function buildOpenGraphImages(title: string, images?: string[]) {
  const normalizedImages = images?.length ? images : [DEFAULT_SEO_IMAGE];

  return normalizedImages.map((image) => ({
    url: absoluteUrl(image),
    width: 1200,
    height: 630,
    alt: title,
  }));
}

type BuildPublicMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  images?: string[];
  noIndex?: boolean;
  type?: "website" | "article";
};

export function buildPublicMetadata({
  title,
  description,
  path,
  keywords,
  images,
  noIndex = false,
  type = "website",
}: BuildPublicMetadataOptions): Metadata {
  const canonicalPath = normalizePath(path);
  const openGraphImages = buildOpenGraphImages(title, images);

  return {
    title,
    description,
    keywords: mergeKeywords(keywords),
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type,
      locale: "pt_BR",
      siteName: BRAND.name,
      url: canonicalPath,
      title,
      description,
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: openGraphImages.map((image) => image.url),
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}

export function buildNoIndexMetadata(
  options: Omit<BuildPublicMetadataOptions, "noIndex">,
) {
  return buildPublicMetadata({
    ...options,
    noIndex: true,
  });
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
