import { createProductSale } from "@/lib/commerce/service";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  mutationLimiter,
} from "@/lib/rate-limit";
import { createProductSaleSchema, parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageSales");
    const input = await parseJsonBody(request, createProductSaleSchema);
    const rateLimit = await enforceRateLimit({
      request,
      limiter: mutationLimiter,
      keyParts: [session.user.id, "product-sales", input.studentProfileId ?? "walk-in"],
    });
    rateLimitHeaders = rateLimit.headers;

    const result = await createProductSale(input, {
      viewer: {
        userId: session.user.id,
        role: session.user.role,
        studentProfileId: null,
        teacherProfileId: null,
      },
      request,
    });

    return attachRateLimitHeaders(
      successResponse(
        {
          saleId: result.id,
          message: "Venda registrada com sucesso.",
        },
        { status: 201 },
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "product sales create route",
      headers: rateLimitHeaders,
    });
  }
}
