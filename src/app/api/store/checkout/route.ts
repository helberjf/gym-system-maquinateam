import { after } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/app-url";
import { handleRouteError, successResponse } from "@/lib/errors";
import { safeSendEmail, sendOrderConfirmationEmail } from "@/lib/mail";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createStoreCheckoutSession } from "@/lib/store/orders";
import { checkoutSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await getOptionalSession();
    const input = await parseJsonBody(request, checkoutSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [
        session?.user?.id ?? "guest",
        "store-checkout",
        input.deliveryMethod,
        input.paymentMethod,
      ],
    });
    rateLimitHeaders = rateLimit.headers;

    const checkout = await createStoreCheckoutSession(input, {
      userId: session?.user?.id ?? null,
      request,
    });

    if (checkout.customerEmail) {
      const trackOrderUrl = `${getAppUrl()}/minha-conta/pedidos/${checkout.orderId}`;
      after(() =>
        safeSendEmail("order-confirmation", sendOrderConfirmationEmail, {
          email: checkout.customerEmail as string,
          name: checkout.customerName,
          orderNumber: checkout.orderNumber,
          totalCents: checkout.totalCents,
          subtotalCents: checkout.subtotalCents,
          discountCents: checkout.discountCents,
          shippingCents: checkout.shippingCents,
          deliveryLabel: checkout.deliveryLabel,
          paymentMethod: checkout.paymentMethod,
          items: checkout.emailItems,
          trackOrderUrl,
        }),
      );
    }

    return attachRateLimitHeaders(
      successResponse(
        {
          orderId: checkout.orderId,
          orderNumber: checkout.orderNumber,
          totalCents: checkout.totalCents,
          redirectUrl: checkout.redirectUrl,
          message: "Checkout online iniciado com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "store checkout route",
      headers: rateLimitHeaders,
    });
  }
}
