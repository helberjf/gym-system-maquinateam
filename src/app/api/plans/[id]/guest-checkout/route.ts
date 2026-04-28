import { createGuestPlanCheckoutSession } from "@/lib/billing/self-service";
import { handleRouteError, successResponse } from "@/lib/errors";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  registerLimiter,
} from "@/lib/rate-limit";
import { guestPlanCheckoutSchema } from "@/lib/validators/auth";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

type RouteParams = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, guestPlanCheckoutSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: registerLimiter,
      keyParts: [input.email, "plan-guest-checkout", id],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createGuestPlanCheckoutSession(id, input, {
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          subscriptionId: result.subscriptionId,
          redirectUrl: result.redirectUrl,
          email: result.email,
          message:
            "Cadastro criado e checkout iniciado. Voce sera redirecionado para o pagamento.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "plan guest checkout route",
      headers: rateLimitHeaders,
    });
  }
}
