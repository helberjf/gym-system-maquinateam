export function getAppUrl(origin?: string | null) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    origin?.trim() ||
    "http://localhost:3000"
  );
}

