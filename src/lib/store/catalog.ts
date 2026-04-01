import type { Prisma } from "@prisma/client";
import { ProductStatus } from "@prisma/client";
import type { z } from "zod";
import { isLowStockProduct } from "@/lib/commerce/constants";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { CatalogSortValue } from "@/lib/store/constants";
import type { catalogFiltersSchema } from "@/lib/validators/store";

type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

export type StoreCatalogDataSource = "live" | "fallback";

export type StoreCatalogImage = {
  id?: string;
  url: string;
  altText: string | null;
  isPrimary?: boolean;
};

export type StoreCatalogProductCard = {
  id: string;
  name: string;
  slug: string;
  category: string;
  shortDescription: string | null;
  priceCents: number;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  status: ProductStatus;
  featured: boolean;
  images: StoreCatalogImage[];
};

export type StoreProductDetailRecord = StoreCatalogProductCard & {
  sku: string;
  description: string | null;
  weightGrams: number | null;
  heightCm: number | null;
  widthCm: number | null;
  lengthCm: number | null;
  images: Array<StoreCatalogImage & { id: string; isPrimary: boolean }>;
};

const FALLBACK_STORE_PRODUCTS: StoreProductDetailRecord[] = [
  {
    id: "fallback-luva-boxe-maquina-team-12oz",
    name: "Luva de Boxe Maquina Team 12oz",
    slug: "luva-boxe-maquina-team-12oz",
    sku: "MT-LUVA-12OZ",
    category: "Luvas e protecao",
    shortDescription: "Luva premium para manopla, saco e sparring leve.",
    description:
      "Luva para treino tecnico e sparring leve com fechamento em velcro e curadoria da Maquina Team.",
    status: ProductStatus.ACTIVE,
    priceCents: 19900,
    stockQuantity: 12,
    lowStockThreshold: 3,
    trackInventory: true,
    featured: true,
    weightGrams: 620,
    heightCm: 16,
    widthCm: 22,
    lengthCm: 34,
    images: [
      {
        id: "fallback-luva-1",
        url: "/images/instrutor.jpg",
        altText: "Luva de boxe Maquina Team",
        isPrimary: true,
      },
      {
        id: "fallback-luva-2",
        url: "/images/mulher_lutando.jpg",
        altText: "Treino com luvas Maquina Team",
        isPrimary: false,
      },
    ],
  },
  {
    id: "fallback-bandagem-elastica-profissional-4m",
    name: "Bandagem Elastico Profissional 4m",
    slug: "bandagem-elastica-profissional-4m",
    sku: "MT-BAND-4M",
    category: "Acessorios",
    shortDescription: "Bandagem essencial para protecao de punhos e encaixe da luva.",
    description:
      "Bandagem elastica para protecao de punhos e metacarpos, indicada para rotina de treino e rounds tecnicos.",
    status: ProductStatus.ACTIVE,
    priceCents: 3900,
    stockQuantity: 40,
    lowStockThreshold: 5,
    trackInventory: true,
    featured: true,
    weightGrams: 110,
    heightCm: 6,
    widthCm: 10,
    lengthCm: 14,
    images: [
      {
        id: "fallback-bandagem-1",
        url: "/images/mulher_lutando.jpg",
        altText: "Bandagem elastica para treino",
        isPrimary: true,
      },
    ],
  },
  {
    id: "fallback-caneleira-muay-thai-pro",
    name: "Caneleira Muay Thai Pro",
    slug: "caneleira-muay-thai-pro",
    sku: "MT-CAN-001",
    category: "Protecao",
    shortDescription: "Caneleira de alto impacto para treino tecnico e rounds de clinch.",
    description:
      "Caneleira com espuma de alta densidade para absorcao de impacto e estabilidade em treinos fortes.",
    status: ProductStatus.ACTIVE,
    priceCents: 24900,
    stockQuantity: 8,
    lowStockThreshold: 3,
    trackInventory: true,
    featured: false,
    weightGrams: 950,
    heightCm: 18,
    widthCm: 20,
    lengthCm: 38,
    images: [
      {
        id: "fallback-caneleira-1",
        url: "/images/interior.webp",
        altText: "Caneleira para Muay Thai",
        isPrimary: true,
      },
    ],
  },
  {
    id: "fallback-camiseta-dry-fit-maquina-team",
    name: "Camiseta Dry Fit Maquina Team",
    slug: "camiseta-dry-fit-maquina-team",
    sku: "MT-CAM-DRY",
    category: "Vestuario",
    shortDescription: "Camiseta oficial da academia com secagem rapida e visual clean.",
    description:
      "Camiseta oficial para treinos com tecido leve, secagem rapida e identidade forte da Maquina Team.",
    status: ProductStatus.ACTIVE,
    priceCents: 7900,
    stockQuantity: 25,
    lowStockThreshold: 5,
    trackInventory: true,
    featured: true,
    weightGrams: 210,
    heightCm: 3,
    widthCm: 28,
    lengthCm: 32,
    images: [
      {
        id: "fallback-cam-dry-1",
        url: "/images/logo.jpg",
        altText: "Camiseta oficial Maquina Team",
        isPrimary: true,
      },
      {
        id: "fallback-cam-dry-2",
        url: "/images/fachada.webp",
        altText: "Camiseta Dry Fit Maquina Team",
        isPrimary: false,
      },
    ],
  },
  {
    id: "fallback-short-muay-thai-maquina-team",
    name: "Short Muay Thai Maquina Team",
    slug: "short-muay-thai-maquina-team",
    sku: "MT-SHORT-MT",
    category: "Vestuario",
    shortDescription: "Short oficial para treino tecnico, sparring e aulas intensas.",
    description:
      "Short leve com recorte lateral para mobilidade em joelhadas, chutes e deslocamentos rapidos.",
    status: ProductStatus.ACTIVE,
    priceCents: 11900,
    stockQuantity: 18,
    lowStockThreshold: 4,
    trackInventory: true,
    featured: true,
    weightGrams: 180,
    heightCm: 3,
    widthCm: 24,
    lengthCm: 28,
    images: [
      {
        id: "fallback-short-1",
        url: "/images/mulher_lutando.jpg",
        altText: "Short Muay Thai Maquina Team",
        isPrimary: true,
      },
      {
        id: "fallback-short-2",
        url: "/images/instrutor.jpg",
        altText: "Treino com short Maquina Team",
        isPrimary: false,
      },
    ],
  },
  {
    id: "fallback-protetor-bucal-premium",
    name: "Protetor Bucal Premium",
    slug: "protetor-bucal-premium",
    sku: "MT-BUCAL-PRM",
    category: "Protecao",
    shortDescription:
      "Protecao firme para sparring e treino de contato com encaixe confortavel.",
    description:
      "Protetor bucal de dupla densidade com estojo, pronto para rounds tecnicos e sparring.",
    status: ProductStatus.ACTIVE,
    priceCents: 5900,
    stockQuantity: 30,
    lowStockThreshold: 5,
    trackInventory: true,
    featured: false,
    weightGrams: 90,
    heightCm: 4,
    widthCm: 9,
    lengthCm: 12,
    images: [
      {
        id: "fallback-bucal-1",
        url: "/images/interior.webp",
        altText: "Protetor bucal premium",
        isPrimary: true,
      },
    ],
  },
  {
    id: "fallback-corda-speed-pro",
    name: "Corda Speed Pro",
    slug: "corda-speed-pro",
    sku: "MT-CORDA-SPD",
    category: "Acessorios",
    shortDescription: "Corda ajustavel para aquecimento, cardio e condicionamento de luta.",
    description:
      "Corda de velocidade com cabo leve e giro rapido para rounds de aquecimento e explosao.",
    status: ProductStatus.ACTIVE,
    priceCents: 4900,
    stockQuantity: 22,
    lowStockThreshold: 5,
    trackInventory: true,
    featured: true,
    weightGrams: 140,
    heightCm: 5,
    widthCm: 14,
    lengthCm: 18,
    images: [
      {
        id: "fallback-corda-1",
        url: "/images/logo.jpg",
        altText: "Corda Speed Pro",
        isPrimary: true,
      },
    ],
  },
  {
    id: "fallback-squeeze-aluminio-maquina-team",
    name: "Squeeze Aluminio Maquina Team",
    slug: "squeeze-aluminio-maquina-team",
    sku: "MT-SQZ-ALU",
    category: "Hidratacao",
    shortDescription: "Squeeze oficial da academia para treino, aula e rotina diaria.",
    description:
      "Garrafa squeeze em aluminio com tampa rosqueavel, leve e resistente para treinos e deslocamento.",
    status: ProductStatus.ACTIVE,
    priceCents: 6900,
    stockQuantity: 16,
    lowStockThreshold: 4,
    trackInventory: true,
    featured: false,
    weightGrams: 210,
    heightCm: 7,
    widthCm: 7,
    lengthCm: 24,
    images: [
      {
        id: "fallback-squeeze-1",
        url: "/images/interior.webp",
        altText: "Squeeze Aluminio Maquina Team",
        isPrimary: true,
      },
    ],
  },
  {
    id: "fallback-camiseta-casual-maquina-team",
    name: "Camiseta Casual Maquina Team",
    slug: "camiseta-casual-maquina-team",
    sku: "MT-CAM-CAS",
    category: "Vestuario",
    shortDescription: "Camiseta casual preta para uso fora do treino com identidade da academia.",
    description:
      "Camiseta casual em algodao premium para quem quer vestir a marca da academia no dia a dia.",
    status: ProductStatus.ACTIVE,
    priceCents: 8900,
    stockQuantity: 14,
    lowStockThreshold: 4,
    trackInventory: true,
    featured: false,
    weightGrams: 230,
    heightCm: 3,
    widthCm: 28,
    lengthCm: 32,
    images: [
      {
        id: "fallback-cam-cas-1",
        url: "/images/fachada.webp",
        altText: "Camiseta casual Maquina Team",
        isPrimary: true,
      },
      {
        id: "fallback-cam-cas-2",
        url: "/images/logo.jpg",
        altText: "Marca Maquina Team",
        isPrimary: false,
      },
    ],
  },
];

function isCatalogFilterDefault(filters: CatalogFilters) {
  return (
    !filters.q &&
    !filters.category &&
    filters.availability === "all" &&
    filters.sort === "featured" &&
    filters.priceMin === undefined &&
    filters.priceMax === undefined
  );
}

function getPublicProductWhere(filters?: Partial<CatalogFilters>): Prisma.ProductWhereInput {
  return {
    storeVisible: true,
    status: {
      not: ProductStatus.ARCHIVED,
    },
    ...(filters?.category
      ? {
          category: filters.category,
        }
      : {}),
    ...(filters?.q
      ? {
          OR: [
            {
              name: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              shortDescription: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              category: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(filters?.priceMin !== undefined || filters?.priceMax !== undefined
      ? {
          priceCents: {
            ...(filters?.priceMin !== undefined
              ? {
                  gte: filters.priceMin,
                }
              : {}),
            ...(filters?.priceMax !== undefined
              ? {
                  lte: filters.priceMax,
                }
              : {}),
          },
        }
      : {}),
  };
}

function getCatalogOrderBy(sort: CatalogSortValue): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "price_asc":
      return [{ priceCents: "asc" }, { name: "asc" }];
    case "price_desc":
      return [{ priceCents: "desc" }, { name: "asc" }];
    case "name_asc":
      return [{ name: "asc" }];
    case "featured":
    default:
      return [{ featured: "desc" }, { status: "asc" }, { createdAt: "desc" }];
  }
}

function sortCatalogProducts(
  products: StoreCatalogProductCard[],
  sort: CatalogSortValue,
) {
  const sorted = [...products];

  sorted.sort((left, right) => {
    switch (sort) {
      case "newest":
        return right.name.localeCompare(left.name);
      case "price_asc":
        return left.priceCents - right.priceCents || left.name.localeCompare(right.name);
      case "price_desc":
        return right.priceCents - left.priceCents || left.name.localeCompare(right.name);
      case "name_asc":
        return left.name.localeCompare(right.name);
      case "featured":
      default:
        return Number(right.featured) - Number(left.featured) || left.name.localeCompare(right.name);
    }
  });

  return sorted;
}

function matchesAvailability(product: StoreCatalogProductCard, availability: CatalogFilters["availability"]) {
  if (availability === "in_stock") {
    return !product.trackInventory || product.stockQuantity > 0;
  }

  if (availability === "low_stock") {
    return isLowStockProduct({
      trackInventory: product.trackInventory,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      status: product.status,
    });
  }

  return true;
}

function filterFallbackProducts(filters: CatalogFilters) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  const filtered = FALLBACK_STORE_PRODUCTS.filter((product) => {
    if (filters.category && product.category !== filters.category) {
      return false;
    }

    if (
      normalizedQuery &&
      ![
        product.name,
        product.category,
        product.shortDescription ?? "",
        product.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    ) {
      return false;
    }

    if (filters.priceMin !== undefined && product.priceCents < filters.priceMin) {
      return false;
    }

    if (filters.priceMax !== undefined && product.priceCents > filters.priceMax) {
      return false;
    }

    return matchesAvailability(product, filters.availability);
  });

  return sortCatalogProducts(filtered, filters.sort as CatalogSortValue);
}

function buildCatalogSummary(products: StoreCatalogProductCard[]) {
  return {
    totalProducts: products.length,
    featuredProducts: products.filter((product) => product.featured).length,
    inStockProducts: products.filter(
      (product) => !product.trackInventory || product.stockQuantity > 0,
    ).length,
  };
}

function getFallbackCategories() {
  return [...new Set(FALLBACK_STORE_PRODUCTS.map((product) => product.category))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export const publicProductCardSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  shortDescription: true,
  priceCents: true,
  stockQuantity: true,
  lowStockThreshold: true,
  trackInventory: true,
  status: true,
  featured: true,
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 4,
    select: {
      id: true,
      url: true,
      altText: true,
      isPrimary: true,
    },
  },
} satisfies Prisma.ProductSelect;

function buildFallbackCatalogData(filters: CatalogFilters) {
  const products = filterFallbackProducts(filters);

  return {
    products,
    categories: getFallbackCategories(),
    summary: buildCatalogSummary(products),
    source: "fallback" as const,
  };
}

export async function getFeaturedStoreProducts(limit = 4) {
  try {
    const products = await prisma.product.findMany({
      where: {
        storeVisible: true,
        status: ProductStatus.ACTIVE,
        OR: [
          {
            featured: true,
          },
          {
            stockQuantity: {
              gt: 0,
            },
          },
          {
            trackInventory: false,
          },
        ],
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: publicProductCardSelect,
    });

    if (products.length > 0) {
      return products as StoreCatalogProductCard[];
    }
  } catch (error) {
    console.error("Falha ao carregar produtos em destaque da loja.", error);
  }

  return sortCatalogProducts(FALLBACK_STORE_PRODUCTS, "featured").slice(0, limit);
}

export async function getStoreCatalogData(filters: CatalogFilters) {
  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: getPublicProductWhere(filters),
        orderBy: getCatalogOrderBy(filters.sort as CatalogSortValue),
        select: publicProductCardSelect,
      }),
      prisma.product.findMany({
        where: {
          storeVisible: true,
          status: {
            not: ProductStatus.ARCHIVED,
          },
        },
        distinct: ["category"],
        orderBy: {
          category: "asc",
        },
        select: {
          category: true,
        },
      }),
    ]);

    const filteredProducts = (products as StoreCatalogProductCard[]).filter((product) =>
      matchesAvailability(product, filters.availability),
    );

    if (filteredProducts.length === 0 && isCatalogFilterDefault(filters)) {
      return buildFallbackCatalogData(filters);
    }

    return {
      products: filteredProducts,
      categories: categories.map((entry) => entry.category),
      summary: buildCatalogSummary(filteredProducts),
      source: "live" as const,
    };
  } catch (error) {
    console.error("Falha ao carregar o catalogo publico da loja.", error);
    return buildFallbackCatalogData(filters);
  }
}

export async function getStoreProductDetail(slug: string) {
  try {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        storeVisible: true,
        status: {
          not: ProductStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        category: true,
        shortDescription: true,
        description: true,
        priceCents: true,
        status: true,
        stockQuantity: true,
        lowStockThreshold: true,
        trackInventory: true,
        featured: true,
        weightGrams: true,
        heightCm: true,
        widthCm: true,
        lengthCm: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            url: true,
            altText: true,
            isPrimary: true,
          },
        },
      },
    });

    if (product) {
      const relatedProducts = await prisma.product.findMany({
        where: {
          id: {
            not: product.id,
          },
          storeVisible: true,
          status: ProductStatus.ACTIVE,
          category: product.category,
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: publicProductCardSelect,
      });

      return {
        product: product as StoreProductDetailRecord,
        relatedProducts: relatedProducts as StoreCatalogProductCard[],
        source: "live" as const,
      };
    }
  } catch (error) {
    console.error("Falha ao carregar detalhe do produto da loja.", error);
  }

  const fallbackProduct = FALLBACK_STORE_PRODUCTS.find((product) => product.slug === slug);

  if (!fallbackProduct) {
    throw new NotFoundError("Produto nao encontrado.");
  }

  return {
    product: fallbackProduct,
    relatedProducts: FALLBACK_STORE_PRODUCTS.filter(
      (product) => product.slug !== slug && product.category === fallbackProduct.category,
    ).slice(0, 4),
    source: "fallback" as const,
  };
}

export const getFeaturedProducts = getFeaturedStoreProducts;
