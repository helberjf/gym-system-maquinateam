import { ProductStatus, SaleStatus } from "@prisma/client";
import { isLowStockProduct } from "@/lib/commerce/constants";

export function getProductStatusTone(status: ProductStatus) {
  switch (status) {
    case ProductStatus.ACTIVE:
      return "success" as const;
    case ProductStatus.OUT_OF_STOCK:
      return "danger" as const;
    case ProductStatus.ARCHIVED:
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function getSaleStatusTone(status: SaleStatus) {
  switch (status) {
    case SaleStatus.PAID:
      return "success" as const;
    case SaleStatus.PENDING:
      return "warning" as const;
    case SaleStatus.CANCELLED:
      return "neutral" as const;
    case SaleStatus.REFUNDED:
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function getStockHealthTone(input: Parameters<typeof isLowStockProduct>[0]) {
  if (input.status === ProductStatus.ARCHIVED) {
    return "neutral" as const;
  }

  if (input.trackInventory && input.stockQuantity <= 0) {
    return "danger" as const;
  }

  if (isLowStockProduct(input)) {
    return "warning" as const;
  }

  return "success" as const;
}
