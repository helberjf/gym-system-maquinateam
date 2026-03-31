export function sanitizeCallbackUrl(callbackUrl?: string | null, fallback = "/dashboard") {
  if (!callbackUrl || typeof callbackUrl !== "string") {
    return fallback;
  }

  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return fallback;
  }

  return callbackUrl;
}
