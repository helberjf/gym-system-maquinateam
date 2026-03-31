import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { startOfDay } from "@/lib/academy/constants";

export type PaymentFilterStatus = PaymentStatus | "OVERDUE";
export type PaymentMethodFilter =
  | "PIX"
  | "CARD"
  | "CASH"
  | "BANK_TRANSFER"
  | "OTHER";

export const PLAN_INTERVAL_OPTIONS = [
  { value: 1, label: "Mensal" },
  { value: 3, label: "Trimestral" },
  { value: 6, label: "Semestral" },
  { value: 12, label: "Anual" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.PIX, label: "PIX" },
  { value: PaymentMethod.CASH, label: "Dinheiro" },
  { value: PaymentMethod.CREDIT_CARD, label: "Cartao" },
  { value: PaymentMethod.DEBIT_CARD, label: "Cartao" },
  { value: PaymentMethod.BANK_TRANSFER, label: "Transferencia" },
  { value: PaymentMethod.BOLETO, label: "Outro" },
] as const;

export const PAYMENT_METHOD_FILTER_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "CARD", label: "Cartao" },
  { value: "CASH", label: "Dinheiro" },
  { value: "BANK_TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Outro" },
] as const satisfies ReadonlyArray<{
  value: PaymentMethodFilter;
  label: string;
}>;

export const PAYMENT_FORM_STATUS_OPTIONS = [
  { value: PaymentStatus.PENDING, label: "Pendente" },
  { value: PaymentStatus.PAID, label: "Pago" },
  { value: PaymentStatus.CANCELLED, label: "Cancelado" },
] as const;

export const PAYMENT_FILTER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendente" },
  { value: "OVERDUE", label: "Atrasado" },
  { value: "PAID", label: "Pago" },
  { value: "CANCELLED", label: "Cancelado" },
] as const satisfies ReadonlyArray<{
  value: PaymentFilterStatus;
  label: string;
}>;

export const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: SubscriptionStatus.ACTIVE, label: "Ativa" },
  { value: SubscriptionStatus.PAST_DUE, label: "Em atraso" },
  { value: SubscriptionStatus.PENDING, label: "Pendente" },
  { value: SubscriptionStatus.PAUSED, label: "Pausada" },
  { value: SubscriptionStatus.CANCELLED, label: "Cancelada" },
  { value: SubscriptionStatus.EXPIRED, label: "Expirada" },
] as const;

export function formatCurrencyFromCents(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);
}

export function formatMonthsLabel(value?: number | null) {
  if (!value) {
    return "Nao definido";
  }

  if (value === 1) {
    return "1 mes";
  }

  return `${value} meses`;
}

export function getBillingIntervalLabel(months: number) {
  const knownOption = PLAN_INTERVAL_OPTIONS.find((option) => option.value === months);

  if (knownOption) {
    return knownOption.label;
  }

  return `A cada ${formatMonthsLabel(months)}`;
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus) {
  return (
    SUBSCRIPTION_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function getPaymentMethodLabel(method: PaymentMethod) {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method
  );
}

export function isPaymentOverdue(
  status: PaymentStatus,
  dueDate?: Date | string | null,
  referenceDate = new Date(),
) {
  if (status !== PaymentStatus.PENDING || !dueDate) {
    return false;
  }

  const normalizedDueDate =
    typeof dueDate === "string" ? new Date(dueDate) : dueDate;

  return startOfDay(normalizedDueDate) < startOfDay(referenceDate);
}

export function getPaymentDisplayStatus(
  status: PaymentStatus,
  dueDate?: Date | string | null,
) {
  if (isPaymentOverdue(status, dueDate)) {
    return "OVERDUE" satisfies PaymentFilterStatus;
  }

  return status satisfies PaymentFilterStatus;
}

export function getPaymentStatusLabel(
  status: PaymentStatus,
  dueDate?: Date | string | null,
) {
  const displayStatus = getPaymentDisplayStatus(status, dueDate);

  switch (displayStatus) {
    case "OVERDUE":
      return "Atrasado";
    case PaymentStatus.PAID:
      return "Pago";
    case PaymentStatus.CANCELLED:
      return "Cancelado";
    case PaymentStatus.REFUNDED:
      return "Estornado";
    case PaymentStatus.FAILED:
      return "Falhou";
    default:
      return "Pendente";
  }
}

export function getPaymentMethodFilterValues(method: PaymentMethodFilter) {
  switch (method) {
    case "CARD":
      return [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD];
    case "OTHER":
      return [PaymentMethod.BOLETO];
    case "BANK_TRANSFER":
      return [PaymentMethod.BANK_TRANSFER];
    case "CASH":
      return [PaymentMethod.CASH];
    case "PIX":
    default:
      return [PaymentMethod.PIX];
  }
}
