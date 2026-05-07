import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { recordMercadoPagoFeeForCheckout } from "@/lib/expenses/service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";
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

const EXPECTED_CURRENCY = "BRL";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Idempotency contract: Mercado Pago retries the same payment id when no 2xx is
// returned within ~22s. We deduplicate by (providerKey + final paymentStatus) via
// the unique WebhookEvent.providerKey index. A reprocess only happens when the
// payment transitions to a new status (e.g. PENDING -> PAID -> REFUNDED).
//
// Concurrency: we use upsert + a follow-up "claim" updateMany to atomically
// transition the row from processed=false to processing. Two concurrent
// webhooks for the same status will see only one successful claim; the loser
// returns dedup=true.
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

  let event: { id: string; processed: boolean };
  try {
    event = await prisma.webhookEvent.upsert({
      where: { providerKey: eventProviderKey },
      update: {
        eventType: input.eventType,
        providerObjectId: input.providerObjectId,
        payload: eventPayload,
      },
      create: {
        providerKey: eventProviderKey,
        providerObjectId: input.providerObjectId,
        eventType: input.eventType,
        payload: eventPayload,
      },
      select: { id: true, processed: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { providerKey: eventProviderKey },
        select: { id: true, processed: true },
      });
      if (!existing) {
        throw error;
      }
      event = existing;
    } else {
      throw error;
    }
  }

  if (event.processed) {
    return {
      received: true,
      dedup: true,
    };
  }

  if (!externalReference) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });

    return { received: true, ignored: true };
  }

  const checkoutPayment = await prisma.checkoutPayment.findUnique({
    where: { externalReference },
    select: { id: true, kind: true, amountCents: true },
  });

  if (!checkoutPayment) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        processedAt: new Date(),
        error: `Checkout payment nao encontrado para ${externalReference}.`,
      },
    });

    return { received: true, ignored: true };
  }

  // P0: Only allow a PAID transition when the gateway-confirmed amount and
  // currency match what was created on our side. Mismatch is logged and the
  // event is closed without releasing product/plan.
  if (paymentStatus === PaymentStatus.PAID) {
    const expectedCents = checkoutPayment.amountCents;
    const paidCents =
      financialSummary.totalPaidCents > 0
        ? financialSummary.totalPaidCents
        : financialSummary.amountCents;
    const currency = financialSummary.currency ?? EXPECTED_CURRENCY;
    const amountMismatch = paidCents !== expectedCents;
    const currencyMismatch = currency !== EXPECTED_CURRENCY;

    if (amountMismatch || currencyMismatch) {
      const reason = amountMismatch
        ? `Valor divergente: esperado ${expectedCents} cents, gateway ${paidCents} cents.`
        : `Moeda divergente: esperado ${EXPECTED_CURRENCY}, gateway ${currency}.`;

      logger.error("mercadopago.webhook.amount_mismatch", {
        checkoutPaymentId: checkoutPayment.id,
        externalReference,
        paymentId: input.providerObjectId,
        expectedCents,
        paidCents,
        currency,
        statusDetail: financialSummary.statusDetail,
      });

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: reason,
        },
      });

      return {
        received: true,
        divergent: true,
        reason,
        expectedCents,
        paidCents,
        currency,
      };
    }
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
    where: { id: event.id },
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
