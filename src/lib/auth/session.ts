import type { Session } from "next-auth";
import { auth } from "@/auth";

function getAuthErrorType(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { type?: unknown; name?: unknown };

  if (typeof candidate.type === "string") {
    return candidate.type;
  }

  if (typeof candidate.name === "string") {
    return candidate.name;
  }

  return null;
}

export async function getOptionalSession(): Promise<Session | null> {
  try {
    return (await auth()) as Session | null;
  } catch (error) {
    const authErrorType = getAuthErrorType(error);

    if (
      authErrorType === "JWTSessionError" ||
      authErrorType === "SessionTokenError"
    ) {
      return null;
    }

    throw error;
  }
}
