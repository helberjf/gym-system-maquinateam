import { PaymentMethod, ProductStatus, SaleStatus } from "@prisma/client";

export const MAX_PRODUCT_IMAGES = 6;
export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 3 * 1024 * 1024;
export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const PRODUCT_IMAGE_ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
] as const;

export const PRODUCT_STATUS_LABEL_MAP: Record<ProductStatus, string> = {
  ACTIVE: "Ativo",
  OUT_OF_STOCK: "Esgotado",
  ARCHIVED: "Inativo",
};

export const SALE_STATUS_LABEL_MAP: Record<SaleStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelada",
  REFUNDED: "Estornada",
};

export type ProductFilterStatus = ProductStatus | "LOW_STOCK";

export const PRODUCT_FILTER_STATUS_OPTIONS: Array<{
  value: ProductFilterStatus;
  label: string;
}> = [
  { value: ProductStatus.ACTIVE, label: "Ativos" },
  { value: "LOW_STOCK", label: "Estoque baixo" },
  { value: ProductStatus.OUT_OF_STOCK, label: "Esgotados" },
  { value: ProductStatus.ARCHIVED, label: "Inativos" },
];

export const SALE_FILTER_STATUS_OPTIONS: Array<{
  value: SaleStatus;
  label: string;
}> = [
  { value: SaleStatus.PAID, label: "Pagas" },
  { value: SaleStatus.PENDING, label: "Pendentes" },
  { value: SaleStatus.CANCELLED, label: "Canceladas" },
  { value: SaleStatus.REFUNDED, label: "Estornadas" },
];

export const SALE_FORM_STATUS_OPTIONS: Array<{
  value: "PAID" | "PENDING";
  label: string;
}> = [
  { value: SaleStatus.PAID, label: "Paga" },
  { value: SaleStatus.PENDING, label: "Pendente" },
];

export const SALE_PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: PaymentMethod.PIX, label: "PIX" },
  { value: PaymentMethod.CASH, label: "Dinheiro" },
  { value: PaymentMethod.CREDIT_CARD, label: "Cartao" },
  { value: PaymentMethod.BANK_TRANSFER, label: "Transferencia" },
  { value: PaymentMethod.BOLETO, label: "Outro" },
];

export function getProductStatusLabel(status: ProductStatus) {
  return PRODUCT_STATUS_LABEL_MAP[status] ?? status;
}

export function getSaleStatusLabel(status: SaleStatus) {
  return SALE_STATUS_LABEL_MAP[status] ?? status;
}

export function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.PIX:
      return "PIX";
    case PaymentMethod.CASH:
      return "Dinheiro";
    case PaymentMethod.CREDIT_CARD:
    case PaymentMethod.DEBIT_CARD:
      return "Cartao";
    case PaymentMethod.BANK_TRANSFER:
      return "Transferencia";
    case PaymentMethod.BOLETO:
      return "Outro";
    default:
      return method;
  }
}

export function isLowStockProduct(input: {
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  status: ProductStatus;
}) {
  if (!input.trackInventory || input.status === ProductStatus.ARCHIVED) {
    return false;
  }

  return input.stockQuantity > 0 && input.stockQuantity <= input.lowStockThreshold;
}

export function buildSaleNumber(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getUTCDate()).padStart(2, "0");
  const randomSuffix = Math.floor(Math.random() * 9000 + 1000);

  return `VEN-${year}${month}${day}-${randomSuffix}`;
}
