import type { MetadataRoute } from "next";
import { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/products"),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: absoluteUrl("/planos"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/contato"),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: absoluteUrl("/faq"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/politica-de-privacidade"),
      changeFrequency: "yearly",
      priority: 0.35,
    },
    {
      url: absoluteUrl("/termos-de-uso"),
      changeFrequency: "yearly",
      priority: 0.35,
    },
  ];

  try {
    const products = await prisma.product.findMany({
      where: {
        storeVisible: true,
        status: {
          not: ProductStatus.ARCHIVED,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: absoluteUrl(`/products/${product.slug}`),
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
