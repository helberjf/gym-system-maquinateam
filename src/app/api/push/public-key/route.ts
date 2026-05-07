import { handleRouteError, successResponse } from "@/lib/errors";
import { getPublicVapidKey } from "@/lib/push/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const publicKey = getPublicVapidKey();
    return successResponse({ publicKey });
  } catch (error) {
    return handleRouteError(error, { source: "push public key route" });
  }
}
