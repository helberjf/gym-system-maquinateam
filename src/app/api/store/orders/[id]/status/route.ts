import { after } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getAppUrl } from "@/lib/app-url";
import { handleRouteError, successResponse } from "@/lib/errors";
import {
  safeSendEmail,
  sendOrderDeliveredEmail,
  sendOrderShippedEmail,
} from "@/lib/mail";
import { requireApiPermission } from "@/lib/permissions";
import {
  adminLimiter,
  attachRateLimitHeaders,
  enforceRateLimit,
} from "@/lib/rate-limit";
import { updateOrderStatus } from "@/lib/store/orders";
import { parseJsonBody, updateOrderStatusSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageStoreOrders");
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateOrderStatusSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: adminLimiter,
      keyParts: [session.user.id, "store-orders-status", id, input.status],
    });
    rateLimitHeaders = rateLimit.headers;

    const order = await updateOrderStatus(id, input, {
      userId: session.user.id,
      request,
    });

    if (order.customerEmail) {
      const trackOrderUrl = `${getAppUrl()}/minha-conta/pedidos/${order.id}`;

      if (order.status === OrderStatus.SHIPPED) {
        after(() =>
          safeSendEmail("order-shipped", sendOrderShippedEmail, {
            email: order.customerEmail as string,
            name: order.customerName,
            orderNumber: order.orderNumber,
            trackingCode: order.trackingCode,
            deliveryLabel: order.deliveryLabel,
            trackOrderUrl,
          }),
        );
      } else if (order.status === OrderStatus.DELIVERED) {
        after(() =>
          safeSendEmail("order-delivered", sendOrderDeliveredEmail, {
            email: order.customerEmail as string,
            name: order.customerName,
            orderNumber: order.orderNumber,
            trackOrderUrl,
          }),
        );
      }
    }

    return attachRateLimitHeaders(
      successResponse({
        orderId: order.id,
        message: "Status do pedido atualizado com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "store orders status route",
      headers: rateLimitHeaders,
    });
  }
}
