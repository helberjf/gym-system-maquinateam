import {
  CheckoutPaymentKind,
  PaymentMethod,
  PaymentProvider,
} from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  checkAbacatePayPixQrCode,
  mapAbacatePayPixStatus,
} from "@/lib/payments/abacatepay";
import {
  syncPlanCheckoutPayment,
  syncStoreCheckoutPayment,
} from "@/lib/payments/checkout-sync";

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extractStoredPixData(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      brCode: null,
      brCodeBase64: null,
      expiresAt: null,
      providerStatus: null,
    };
  }

  const payload = rawPayload as Record<string, unknown>;

  return {
    brCode: getStringValue(payload.brCode),
    brCodeBase64: getStringValue(payload.brCodeBase64),
    expiresAt: getStringValue(payload.expiresAt),
    providerStatus: getStringValue(payload.status),
  };
}

export async function getPixCheckoutStatus(input: {
  checkoutPaymentId: string;
  userId?: string | null;
}) {
  const checkoutPayment = await prisma.checkoutPayment.findFirst({
    where: {
      id: input.checkoutPaymentId,
      provider: PaymentProvider.ABACATEPAY,
      method: PaymentMethod.PIX,
    },
    select: {
      id: true,
      kind: true,
      userId: true,
      status: true,
      amountCents: true,
      providerPaymentId: true,
      rawPayload: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
      subscription: {
        select: {
          id: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!checkoutPayment) {
    throw new NotFoundError("Pagamento Pix nao encontrado.");
  }

  if (
    checkoutPayment.userId &&
    input.userId &&
    checkoutPayment.userId !== input.userId
  ) {
    throw new NotFoundError("Pagamento Pix nao encontrado.");
  }

  const storedPixData = extractStoredPixData(checkoutPayment.rawPayload);
  let providerStatus = storedPixData.providerStatus;
  let finalPaymentStatus = checkoutPayment.status;
  let syncError: string | null = null;
  let brCode = storedPixData.brCode;
  let qrCodeImage = storedPixData.brCodeBase64;
  let expiresAt = storedPixData.expiresAt;

  if (
    checkoutPayment.providerPaymentId &&
    process.env.ABACATEPAY_API_KEY?.trim()
  ) {
    try {
      const providerData = await checkAbacatePayPixQrCode(
        checkoutPayment.providerPaymentId,
      );
      providerStatus = getStringValue(providerData.status) ?? providerStatus;
      brCode = getStringValue(providerData.brCode) ?? brCode;
      qrCodeImage = getStringValue(providerData.brCodeBase64) ?? qrCodeImage;
      expiresAt = getStringValue(providerData.expiresAt) ?? expiresAt;

      const paymentStatus = mapAbacatePayPixStatus(providerStatus);
      const mergedPayload = {
        ...(checkoutPayment.rawPayload && typeof checkoutPayment.rawPayload === "object"
          ? (checkoutPayment.rawPayload as Record<string, unknown>)
          : {}),
        ...providerData,
      };

      if (
        paymentStatus !== checkoutPayment.status ||
        providerStatus !== storedPixData.providerStatus
      ) {
        if (checkoutPayment.kind === CheckoutPaymentKind.STORE_ORDER) {
          await syncStoreCheckoutPayment({
            checkoutPaymentId: checkoutPayment.id,
            provider: PaymentProvider.ABACATEPAY,
            providerObjectId: checkoutPayment.providerPaymentId,
            paymentStatus,
            paymentMethod: PaymentMethod.PIX,
            paymentDetails: mergedPayload,
          });
        } else {
          await syncPlanCheckoutPayment({
            checkoutPaymentId: checkoutPayment.id,
            provider: PaymentProvider.ABACATEPAY,
            providerObjectId: checkoutPayment.providerPaymentId,
            paymentStatus,
            paymentMethod: PaymentMethod.PIX,
            paymentDetails: mergedPayload,
          });
        }
      }

      finalPaymentStatus = paymentStatus;
    } catch (error) {
      syncError =
        error instanceof Error ? error.message : "Erro ao consultar o Pix.";
    }
  }

  return {
    checkoutPaymentId: checkoutPayment.id,
    paymentId: checkoutPayment.providerPaymentId ?? checkoutPayment.id,
    kind: checkoutPayment.kind,
    amountCents: checkoutPayment.amountCents,
    status: finalPaymentStatus,
    providerStatus,
    brCode,
    qrCodeImage,
    expiresAt,
    syncError,
    orderId: checkoutPayment.order?.id ?? null,
    orderNumber: checkoutPayment.order?.orderNumber ?? null,
    subscriptionId: checkoutPayment.subscription?.id ?? null,
    planName: checkoutPayment.subscription?.plan.name ?? null,
  };
}
