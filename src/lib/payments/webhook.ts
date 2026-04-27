import {
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";
import { recordMercadoPagoFeeForCheckout } from "@/lib/expenses/service";
import { prisma } from "@/lib/prisma";
import {
  syncPlanCheckoutPayment,
  syncStoreCheckoutPayment,
  toJsonValue,
} from "@/lib/payments/checkout-sync";
import {
  fetchMercadoPagoPaymentDetails,
  getMercadoPagoFinancialSummary,
  mapMercadoPagoPaymentMethod,
  mapMercadoPagoPaymentStatus,
} from "@/lib/payments/mercadopago";

type WebhookProcessInput = {
  eventType: string;
  payload: unknown;
  providerKey: string;
  providerObjectId: string;
};

// Idempotency contract: Mercado Pago retries the same payment id when no 2xx is
// returned within ~22s. We deduplicate by (providerKey + final paymentStatus) via
// the unique WebhookEvent.providerKey index. A reprocess only happens when the
// payment transitions to a new status (e.g. PENDING -> PAID -> REFUNDED).
export async function processMercadoPagoPaymentWebhook(
  input: WebhookProcessInput,
) {
  const paymentDetails = await fetchMercadoPagoPaymentDetails(
    input.providerObjectId,
  );
  const externalReference = paymentDetails.external_reference?.trim();
  const paymentStatus = mapMercadoPagoPaymentStatus(paymentDetails.status);
  const paymentMethod = mapMercadoPagoPaymentMethod(
    paymentDetails.payment_type_id,
  );
  const financialSummary = getMercadoPagoFinancialSummary(paymentDetails);
  const eventPayload = toJsonValue({
    webhook: input.payload,
    payment: paymentDetails,
    financial: financialSummary,
  });
  const eventProviderKey = `${input.providerKey}:${paymentStatus}`;
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      providerKey: eventProviderKey,
    },
    select: {
      id: true,
      processed: true,
    },
  });
  const event = existingEvent
    ? await prisma.webhookEvent.update({
        where: {
          providerKey: eventProviderKey,
        },
        data: {
          eventType: input.eventType,
          providerObjectId: input.providerObjectId,
          payload: eventPayload,
        },
        select: {
          id: true,
          processed: true,
        },
      })
    : await prisma.webhookEvent.create({
        data: {
          providerKey: eventProviderKey,
          providerObjectId: input.providerObjectId,
          eventType: input.eventType,
          payload: eventPayload,
        },
        select: {
          id: true,
          processed: true,
        },
      });

  if (event.processed) {
    return {
      received: true,
      dedup: true,
    };
  }

  if (!externalReference) {
    await prisma.webhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return {
      received: true,
      ignored: true,
    };
  }

  const checkoutPayment = await prisma.checkoutPayment.findUnique({
    where: {
      externalReference,
    },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!checkoutPayment) {
    await prisma.webhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        processed: true,
        processedAt: new Date(),
        error: `Checkout payment nao encontrado para ${externalReference}.`,
      },
    });

    return {
      received: true,
      ignored: true,
    };
  }

  if (checkoutPayment.kind === "STORE_ORDER") {
    await syncStoreCheckoutPayment({
      checkoutPaymentId: checkoutPayment.id,
      provider: PaymentProvider.MERCADO_PAGO,
      providerObjectId: input.providerObjectId,
      paymentStatus,
      paymentMethod,
      paymentDetails,
    });
  } else {
    await syncPlanCheckoutPayment({
      checkoutPaymentId: checkoutPayment.id,
      provider: PaymentProvider.MERCADO_PAGO,
      providerObjectId: input.providerObjectId,
      paymentStatus,
      paymentMethod,
      paymentDetails,
    });
  }

  if (
    paymentStatus === PaymentStatus.PAID ||
    paymentStatus === PaymentStatus.REFUNDED
  ) {
    const paidAt = financialSummary.approvedAt
      ? new Date(financialSummary.approvedAt)
      : new Date();
    await recordMercadoPagoFeeForCheckout({
      checkoutPaymentId: checkoutPayment.id,
      paidAt,
      paymentDetails,
    });
  }

  await prisma.webhookEvent.update({
    where: {
      id: event.id,
    },
    data: {
      processed: true,
      processedAt: new Date(),
      error: null,
    },
  });

  return {
    received: true,
    checkoutPaymentId: checkoutPayment.id,
    status: paymentStatus,
    financial: {
      grossAmountCents: financialSummary.amountCents,
      netReceivedCents: financialSummary.netReceivedCents,
      feeCents: financialSummary.feeCents,
      installments: financialSummary.installments,
      statusDetail: financialSummary.statusDetail,
    },
  };
}
