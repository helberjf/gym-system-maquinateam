import {
  CheckoutPaymentKind,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  checkAbacatePayPixQrCode,
  mapAbacatePayPixStatus,
} from "@/lib/payments/abacatepay";
import {
  syncPlanCheckoutPayment,
  syncStoreCheckoutPayment,
} from "@/lib/payments/checkout-sync";

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_AGE_HOURS = 24;

type ReconciliationResult = {
  scanned: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ checkoutPaymentId: string; reason: string }>;
};

export async function reconcilePendingPixCheckouts(options?: {
  batchSize?: number;
  maxAgeHours?: number;
}): Promise<ReconciliationResult> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAgeHours = options?.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  const oldestAt = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  if (!process.env.ABACATEPAY_API_KEY?.trim()) {
    return { scanned: 0, updated: 0, failed: 0, skipped: 0, errors: [] };
  }

  const candidates = await prisma.checkoutPayment.findMany({
    where: {
      provider: PaymentProvider.ABACATEPAY,
      method: PaymentMethod.PIX,
      status: PaymentStatus.PENDING,
      providerPaymentId: { not: null },
      createdAt: { gte: oldestAt },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      kind: true,
      providerPaymentId: true,
      rawPayload: true,
    },
  });

  const result: ReconciliationResult = {
    scanned: candidates.length,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const candidate of candidates) {
    if (!candidate.providerPaymentId) {
      result.skipped += 1;
      continue;
    }

    try {
      const providerData = await checkAbacatePayPixQrCode(
        candidate.providerPaymentId,
      );
      const paymentStatus = mapAbacatePayPixStatus(providerData.status);

      if (paymentStatus === PaymentStatus.PENDING) {
        result.skipped += 1;
        continue;
      }

      const mergedPayload = {
        ...(candidate.rawPayload && typeof candidate.rawPayload === "object"
          ? (candidate.rawPayload as Record<string, unknown>)
          : {}),
        ...providerData,
      };

      if (candidate.kind === CheckoutPaymentKind.STORE_ORDER) {
        await syncStoreCheckoutPayment({
          checkoutPaymentId: candidate.id,
          provider: PaymentProvider.ABACATEPAY,
          providerObjectId: candidate.providerPaymentId,
          paymentStatus,
          paymentMethod: PaymentMethod.PIX,
          paymentDetails: mergedPayload,
        });
      } else {
        await syncPlanCheckoutPayment({
          checkoutPaymentId: candidate.id,
          provider: PaymentProvider.ABACATEPAY,
          providerObjectId: candidate.providerPaymentId,
          paymentStatus,
          paymentMethod: PaymentMethod.PIX,
          paymentDetails: mergedPayload,
        });
      }

      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        checkoutPaymentId: candidate.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
