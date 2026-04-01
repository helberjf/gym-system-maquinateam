import { PaymentMethod, PaymentProvider } from "@prisma/client";

export function resolvePaymentProvider(method: PaymentMethod) {
  if (method === PaymentMethod.PIX) {
    return PaymentProvider.ABACATEPAY;
  }

  return PaymentProvider.MERCADO_PAGO;
}

export function isAbacatePayPixMethod(method: PaymentMethod) {
  return resolvePaymentProvider(method) === PaymentProvider.ABACATEPAY;
}
