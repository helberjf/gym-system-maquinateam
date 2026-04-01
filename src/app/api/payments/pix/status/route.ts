import { z } from "zod";
import { auth } from "@/auth";
import {
  handleRouteError,
  successResponse,
  UnauthorizedError,
} from "@/lib/errors";
import { getPixCheckoutStatus } from "@/lib/payments/pix";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";

const pixStatusQuerySchema = z.object({
  payment: z.string().trim().min(1, "Pagamento nao informado."),
});

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new UnauthorizedError("Entre na sua conta para consultar o Pix.");
    }

    const { payment } = parseSearchParams(
      new URL(request.url).searchParams,
      pixStatusQuerySchema,
    );

    const status = await getPixCheckoutStatus({
      checkoutPaymentId: payment,
      userId: session.user.id,
    });

    return successResponse(status);
  } catch (error) {
    return handleRouteError(error, {
      source: "pix payment status route",
    });
  }
}
