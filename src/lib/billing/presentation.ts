import { SubscriptionStatus } from "@prisma/client";
import {
  getPaymentDisplayStatus,
  type PaymentFilterStatus,
} from "@/lib/billing/constants";

export function getPlanStatusTone(active: boolean) {
  return active ? ("success" as const) : ("neutral" as const);
}

export function getSubscriptionStatusTone(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "success" as const;
    case SubscriptionStatus.PAST_DUE:
      return "danger" as const;
    case SubscriptionStatus.PENDING:
      return "warning" as const;
    case SubscriptionStatus.PAUSED:
      return "neutral" as const;
    case SubscriptionStatus.CANCELLED:
      return "danger" as const;
    case SubscriptionStatus.EXPIRED:
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function getPaymentStatusTone(status: PaymentFilterStatus) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "OVERDUE":
      return "danger" as const;
    case "CANCELLED":
      return "neutral" as const;
    case "FAILED":
      return "danger" as const;
    case "REFUNDED":
      return "warning" as const;
    default:
      return "warning" as const;
  }
}

export function resolvePaymentTone(input: {
  status: Parameters<typeof getPaymentDisplayStatus>[0];
  dueDate?: Parameters<typeof getPaymentDisplayStatus>[1];
}) {
  return getPaymentStatusTone(
    getPaymentDisplayStatus(input.status, input.dueDate),
  );
}
