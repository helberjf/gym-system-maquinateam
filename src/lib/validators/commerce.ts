import { PaymentMethod, ProductStatus, SaleStatus } from "@prisma/client";
import { z } from "zod";
import { MAX_PRODUCT_IMAGES } from "@/lib/commerce/constants";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(255).optional(),
);

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(4000).optional(),
);

const optionalDateString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.")
    .optional(),
);

const optionalInteger = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  },
  z.number().int().optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const currencyField = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return Math.round(value * 100);
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(",", "."));

      if (Number.isNaN(normalized)) {
        return Number.NaN;
      }

      return Math.round(normalized * 100);
    }

    return value;
  },
  z
    .number()
    .int("Informe um valor monetario valido.")
    .nonnegative("O valor nao pode ser negativo."),
);

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens.")
  .max(120);

const productImageSchema = z.object({
  url: z.string().trim().min(1, "Informe a URL da imagem."),
  storageKey: optionalTrimmedString,
  altText: optionalTrimmedString,
  sortOrder: optionalInteger
    .refine((value) => value === undefined || value >= 0, "A ordem deve ser positiva.")
    .default(0),
  isPrimary: optionalBoolean.default(false),
});

const saleItemSchema = z.object({
  productId: z.string().min(1, "Selecione um produto."),
  quantity: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      if (typeof value === "string") {
        return Number(value);
      }

      return value;
    },
    z.number().int().positive("A quantidade deve ser maior que zero."),
  ),
});

export const productFiltersSchema = z.object({
  search: optionalTrimmedString,
  category: optionalTrimmedString,
  status: z
    .enum([
      ProductStatus.ACTIVE,
      ProductStatus.OUT_OF_STOCK,
      ProductStatus.ARCHIVED,
      "LOW_STOCK",
    ])
    .optional(),
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const productBaseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(120),
  slug: slugSchema.optional(),
  sku: z.string().trim().min(2, "Informe o SKU.").max(60),
  category: z.string().trim().min(2, "Informe a categoria.").max(80),
  shortDescription: optionalText,
  description: optionalText,
  priceCents: currencyField.refine((value) => value > 0, "Informe um preco maior que zero."),
  stockQuantity: optionalInteger
    .refine((value) => value === undefined || value >= 0, "O estoque nao pode ser negativo.")
    .default(0),
  lowStockThreshold: optionalInteger
    .refine((value) => value === undefined || value >= 0, "Informe um limite valido.")
    .default(3),
  trackInventory: optionalBoolean.default(true),
  storeVisible: optionalBoolean.default(true),
  featured: optionalBoolean.default(false),
  weightGrams: optionalInteger
    .refine((value) => value === undefined || value >= 0, "Informe um peso valido.")
    .optional(),
  heightCm: optionalInteger
    .refine((value) => value === undefined || value >= 0, "Informe uma altura valida.")
    .optional(),
  widthCm: optionalInteger
    .refine((value) => value === undefined || value >= 0, "Informe uma largura valida.")
    .optional(),
  lengthCm: optionalInteger
    .refine((value) => value === undefined || value >= 0, "Informe um comprimento valido.")
    .optional(),
  active: optionalBoolean.default(true),
  images: z.array(productImageSchema).max(MAX_PRODUCT_IMAGES).default([]),
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema.extend({
  id: z.string().min(1),
});

export const saleFiltersSchema = z.object({
  search: optionalTrimmedString,
  studentId: optionalTrimmedString,
  status: z.nativeEnum(SaleStatus).optional(),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const saleBaseSchema = z.object({
  studentProfileId: optionalTrimmedString,
  customerName: optionalTrimmedString,
  customerDocument: optionalTrimmedString,
  paymentMethod: z
    .enum([
      PaymentMethod.PIX,
      PaymentMethod.CASH,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.BOLETO,
      PaymentMethod.DEBIT_CARD,
    ])
    .default(PaymentMethod.PIX),
  status: z
    .enum([SaleStatus.PAID, SaleStatus.PENDING])
    .default(SaleStatus.PAID),
  discountCents: currencyField.default(0),
  notes: optionalText,
  soldAt: optionalDateString,
  items: z.array(saleItemSchema).min(1, "Adicione pelo menos um item."),
});

export const createProductSaleSchema = saleBaseSchema.superRefine(
  (input, context) => {
    const uniqueProductIds = new Set(input.items.map((item) => item.productId));

    if (uniqueProductIds.size !== input.items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Nao repita o mesmo produto na venda. Ajuste a quantidade do item existente.",
      });
    }
  },
);
