import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProductStatus,
  SubscriptionStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SyncCheckoutPaymentInput = {
  checkoutPaymentId: string;
  provider: PaymentProvider;
  providerObjectId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentDetails: unknown;
};

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value && typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }

  return {};
}

function buildProviderMessages(input: {
  provider: PaymentProvider;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}) {
  const providerLabel =
    input.provider === PaymentProvider.ABACATEPAY
      ? "AbacatePay"
      : "Mercado Pago";
  const paymentLabel =
    input.paymentMethod === PaymentMethod.PIX
      ? "Pagamento Pix"
      : "Pagamento";

  const failureReason =
    input.paymentStatus === PaymentStatus.FAILED
      ? `${paymentLabel} recusado ou nao autorizado pelo ${providerLabel}.`
      : input.paymentStatus === PaymentStatus.CANCELLED
        ? `${paymentLabel} cancelado no ${providerLabel}.`
        : input.paymentStatus === PaymentStatus.REFUNDED
          ? `${paymentLabel} estornado pelo ${providerLabel}.`
          : null;

  const orderHistoryNote =
    input.paymentStatus === PaymentStatus.PAID
      ? `${paymentLabel} confirmado via ${providerLabel}.`
      : input.paymentStatus === PaymentStatus.PENDING
        ? `${paymentLabel} ainda pendente de confirmacao.`
        : input.paymentStatus === PaymentStatus.REFUNDED
          ? `${paymentLabel} estornado pelo gateway.`
          : `${paymentLabel} cancelado ou falhou no gateway.`;

  const shipmentNote =
    input.paymentMethod === PaymentMethod.PIX
      ? "Pagamento confirmado via Pix. Preparando pedido para postagem."
      : `Pagamento confirmado via ${providerLabel}. Preparando pedido para postagem.`;

  const subscriptionNote =
    input.paymentStatus === PaymentStatus.PENDING
      ? null
      : input.paymentStatus === PaymentStatus.PAID
        ? "Assinatura ativada pelo checkout online."
        : "Assinatura cancelada porque o pagamento inicial nao foi confirmado.";

  return {
    providerLabel,
    failureReason,
    orderHistoryNote,
    shipmentNote,
    subscriptionNote,
  };
}

export async function syncStoreCheckoutPayment(
  input: SyncCheckoutPaymentInput,
) {
  const messages = buildProviderMessages(input);

  await prisma.$transaction(async (tx) => {
    const checkoutPayment = await tx.checkoutPayment.findUnique({
      where: {
        id: input.checkoutPaymentId,
      },
      include: {
        order: {
          include: {
            items: true,
            couponRedemption: true,
          },
        },
      },
    });

    if (!checkoutPayment?.order) {
      return;
    }

    const currentOrder = checkoutPayment.order;
    const currentStatus = currentOrder.status;
    const shouldRestoreInventory =
      currentStatus === OrderStatus.PENDING &&
      currentOrder.inventoryRestoredAt === null &&
      input.paymentStatus !== PaymentStatus.PAID;

    await tx.checkoutPayment.update({
      where: {
        id: checkoutPayment.id,
      },
      data: {
        provider: input.provider,
        status: input.paymentStatus,
        method: input.paymentMethod,
        providerPaymentId: input.providerObjectId,
        rawPayload: toJsonValue(input.paymentDetails),
        paidAt:
          input.paymentStatus === PaymentStatus.PAID && checkoutPayment.paidAt === null
            ? new Date()
            : checkoutPayment.paidAt,
        refundedAt:
          input.paymentStatus === PaymentStatus.REFUNDED &&
          checkoutPayment.refundedAt === null
            ? new Date()
            : checkoutPayment.refundedAt,
        failureReason: messages.failureReason,
      },
    });

    if (shouldRestoreInventory) {
      const productIds = currentOrder.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, status: true },
      });
      const productStatusById = new Map(
        products.map((product) => [product.id, product.status] as const),
      );

      const outOfStockIds = currentOrder.items
        .filter(
          (item) =>
            productStatusById.get(item.productId) === ProductStatus.OUT_OF_STOCK,
        )
        .map((item) => item.productId);

      if (outOfStockIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: outOfStockIds } },
          data: { status: ProductStatus.ACTIVE },
        });
      }

      await Promise.all(
        currentOrder.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          }),
        ),
      );

      await tx.inventoryMovement.createMany({
        data: currentOrder.items.map((item) => ({
          productId: item.productId,
          orderId: currentOrder.id,
          type: "ORDER_RESTORE" as const,
          quantityDelta: item.quantity,
          reason: "Estoque devolvido apos cancelamento do pagamento online",
        })),
      });

      if (currentOrder.couponId && currentOrder.couponRedemption) {
        await Promise.all([
          tx.coupon.update({
            where: { id: currentOrder.couponId },
            data: { usageCount: { decrement: 1 } },
          }),
          tx.couponRedemption.delete({
            where: { id: currentOrder.couponRedemption.id },
          }),
        ]);
      }
    }

    const nextOrderStatus =
      input.paymentStatus === PaymentStatus.PAID
        ? OrderStatus.PAID
        : input.paymentStatus === PaymentStatus.PENDING
          ? currentStatus
          : OrderStatus.CANCELLED;

    await tx.order.update({
      where: {
        id: currentOrder.id,
      },
      data: {
        status: nextOrderStatus,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        paidAt:
          input.paymentStatus === PaymentStatus.PAID && currentOrder.paidAt === null
            ? new Date()
            : currentOrder.paidAt,
        cancelledAt:
          nextOrderStatus === OrderStatus.CANCELLED && currentOrder.cancelledAt === null
            ? new Date()
            : currentOrder.cancelledAt,
        inventoryRestoredAt:
          shouldRestoreInventory && currentOrder.inventoryRestoredAt === null
            ? new Date()
            : currentOrder.inventoryRestoredAt,
        statusHistory:
          nextOrderStatus !== currentStatus
            ? {
                create: {
                  status: nextOrderStatus,
                  note: messages.orderHistoryNote,
                },
              }
            : undefined,
      },
    });

    void messages.shipmentNote;
  });
}

export async function syncPlanCheckoutPayment(
  input: SyncCheckoutPaymentInput,
) {
  const messages = buildProviderMessages(input);

  await prisma.$transaction(async (tx) => {
    const checkoutPayment = await tx.checkoutPayment.findUnique({
      where: {
        id: input.checkoutPaymentId,
      },
      include: {
        subscription: {
          include: {
            plan: true,
            studentProfile: true,
          },
        },
      },
    });

    if (!checkoutPayment?.subscription) {
      return;
    }

    await tx.checkoutPayment.update({
      where: {
        id: checkoutPayment.id,
      },
      data: {
        provider: input.provider,
        status: input.paymentStatus,
        method: input.paymentMethod,
        providerPaymentId: input.providerObjectId,
        rawPayload: toJsonValue(input.paymentDetails),
        paidAt:
          input.paymentStatus === PaymentStatus.PAID && checkoutPayment.paidAt === null
            ? new Date()
            : checkoutPayment.paidAt,
        refundedAt:
          input.paymentStatus === PaymentStatus.REFUNDED &&
          checkoutPayment.refundedAt === null
            ? new Date()
            : checkoutPayment.refundedAt,
        failureReason: messages.failureReason,
      },
    });

    if (input.paymentStatus === PaymentStatus.PAID) {
      await tx.subscription.update({
        where: {
          id: checkoutPayment.subscription.id,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          cancelledAt: null,
          notes: checkoutPayment.subscription.notes ?? messages.subscriptionNote,
        },
      });

      const existingPayment = await tx.payment.findFirst({
        where: {
          externalReference: checkoutPayment.externalReference,
        },
        select: {
          id: true,
        },
      });

      if (existingPayment) {
        await tx.payment.update({
          where: {
            id: existingPayment.id,
          },
          data: {
            status: PaymentStatus.PAID,
            method: input.paymentMethod,
            amountCents: checkoutPayment.amountCents,
            paidAt: new Date(),
            dueDate: new Date(),
            gatewayTransactionId: input.providerObjectId,
            description: `Pagamento inicial do plano ${checkoutPayment.subscription.plan.name}`,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            studentProfileId: checkoutPayment.subscription.studentProfileId,
            subscriptionId: checkoutPayment.subscription.id,
            amountCents: checkoutPayment.amountCents,
            status: PaymentStatus.PAID,
            method: input.paymentMethod,
            dueDate: new Date(),
            paidAt: new Date(),
            externalReference: checkoutPayment.externalReference,
            gatewayTransactionId: input.providerObjectId,
            description: `Pagamento inicial do plano ${checkoutPayment.subscription.plan.name}`,
          },
        });
      }

      return;
    }

    if (checkoutPayment.subscription.status === SubscriptionStatus.PENDING) {
      await tx.subscription.update({
        where: {
          id: checkoutPayment.subscription.id,
        },
        data: {
          status:
            input.paymentStatus === PaymentStatus.PENDING
              ? SubscriptionStatus.PENDING
              : SubscriptionStatus.CANCELLED,
          cancelledAt:
            input.paymentStatus === PaymentStatus.PENDING
              ? null
              : checkoutPayment.subscription.cancelledAt ?? new Date(),
          notes:
            input.paymentStatus === PaymentStatus.PENDING
              ? checkoutPayment.subscription.notes
              : messages.subscriptionNote,
        },
      });
    }

    const existingPayment = await tx.payment.findFirst({
      where: {
        externalReference: checkoutPayment.externalReference,
      },
      select: {
        id: true,
      },
    });

    if (existingPayment) {
      await tx.payment.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          status: input.paymentStatus,
          method: input.paymentMethod,
          gatewayTransactionId: input.providerObjectId,
        },
      });
    }
  });
}
