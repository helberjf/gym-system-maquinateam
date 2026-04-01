import {
  PaymentProvider,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  syncPlanCheckoutPayment,
  syncStoreCheckoutPayment,
  toJsonValue,
} from "@/lib/payments/checkout-sync";
import {
  fetchMercadoPagoPaymentDetails,
  mapMercadoPagoPaymentMethod,
  mapMercadoPagoPaymentStatus,
} from "@/lib/payments/mercadopago";

type WebhookProcessInput = {
  eventType: string;
  payload: unknown;
  providerKey: string;
  providerObjectId: string;
};

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
          payload: toJsonValue(input.payload),
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
          payload: toJsonValue(input.payload),
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
  };
}
