import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { TooManyRequestsError } from "@/lib/errors";

type RateLimitKeyPart =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type RateLimitProfile = {
  key: string;
  limit: number;
  windowMs: number;
  message: string;
};

type RateLimitState = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  headers: Headers;
  backend: "upstash" | "memory";
};

type MemoryStoreEntry = {
  timestamps: number[];
};

type RateLimitCache = {
  memoryStore: Map<string, MemoryStoreEntry>;
  redis?: Redis;
  limiterMap: Map<string, Ratelimit>;
  warnedAboutFallback?: boolean;
  lastMemoryGcAt?: number;
};

const rateLimitCache = globalThis as typeof globalThis & {
  __maquinaRateLimitCache__?: RateLimitCache;
};

function getCache() {
  if (!rateLimitCache.__maquinaRateLimitCache__) {
    rateLimitCache.__maquinaRateLimitCache__ = {
      memoryStore: new Map(),
      limiterMap: new Map(),
    };
  }

  return rateLimitCache.__maquinaRateLimitCache__;
}

function isDistributedRateLimitEnabled() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function warnIfUsingMemoryFallback() {
  const cache = getCache();

  if (
    process.env.NODE_ENV === "production" &&
    !isDistributedRateLimitEnabled() &&
    !cache.warnedAboutFallback
  ) {
    cache.warnedAboutFallback = true;
    console.warn(
      "rate limit fallback: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured. Production will use instance-local memory rate limiting.",
    );
  }
}

function getRedisClient() {
  const cache = getCache();

  if (!cache.redis) {
    cache.redis = Redis.fromEnv();
  }

  return cache.redis;
}

function toDuration(windowMs: number) {
  if (windowMs % 86_400_000 === 0) {
    return `${windowMs / 86_400_000}d` as const;
  }

  if (windowMs % 3_600_000 === 0) {
    return `${windowMs / 3_600_000}h` as const;
  }

  if (windowMs % 60_000 === 0) {
    return `${windowMs / 60_000}m` as const;
  }

  if (windowMs % 1_000 === 0) {
    return `${windowMs / 1_000}s` as const;
  }

  return `${windowMs}ms` as const;
}

function getLimiter(profile: RateLimitProfile) {
  const cache = getCache();
  const cacheKey = `${profile.key}:${profile.limit}:${profile.windowMs}`;

  if (!cache.limiterMap.has(cacheKey)) {
    cache.limiterMap.set(
      cacheKey,
      new Ratelimit({
        redis: getRedisClient(),
        limiter: Ratelimit.slidingWindow(
          profile.limit,
          toDuration(profile.windowMs),
        ),
        analytics: false,
        prefix: `maquinateam:${profile.key}`,
      }),
    );
  }

  return cache.limiterMap.get(cacheKey)!;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function normalizeKeyPart(part: RateLimitKeyPart) {
  if (part === null || part === undefined) {
    return null;
  }

  if (part instanceof Date) {
    return part.toISOString();
  }

  return String(part).trim().toLowerCase();
}

function hashIdentifier(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildRateLimitIdentifier(options: {
  request: Request;
  keyParts?: RateLimitKeyPart[];
  includeUserAgent?: boolean;
}) {
  const parts = [
    getClientIp(options.request),
    options.includeUserAgent
      ? options.request.headers.get("user-agent")
      : null,
    ...(options.keyParts ?? []),
  ]
    .map(normalizeKeyPart)
    .filter((value): value is string => Boolean(value));

  return hashIdentifier(parts.join("|"));
}

function buildRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number;
}) {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  headers.set("X-RateLimit-Reset", String(result.reset));

  return headers;
}

const MEMORY_STORE_GC_INTERVAL_MS = 60_000;
const MEMORY_STORE_MAX_ENTRIES = 10_000;

function pruneMemoryStore(
  store: Map<string, MemoryStoreEntry>,
  now: number,
  maxWindowMs: number,
) {
  for (const [key, entry] of store) {
    const lastTimestamp = entry.timestamps[entry.timestamps.length - 1];
    if (lastTimestamp === undefined || lastTimestamp <= now - maxWindowMs) {
      store.delete(key);
    }
  }
}

async function applyMemoryRateLimit(
  identifier: string,
  profile: RateLimitProfile,
): Promise<RateLimitState> {
  const now = Date.now();
  const windowStart = now - profile.windowMs;
  const cache = getCache();

  if (
    !cache.lastMemoryGcAt ||
    now - cache.lastMemoryGcAt > MEMORY_STORE_GC_INTERVAL_MS ||
    cache.memoryStore.size > MEMORY_STORE_MAX_ENTRIES
  ) {
    pruneMemoryStore(cache.memoryStore, now, profile.windowMs);
    cache.lastMemoryGcAt = now;
  }

  const currentEntry = cache.memoryStore.get(identifier) ?? {
    timestamps: [],
  };
  const validTimestamps = currentEntry.timestamps.filter(
    (timestamp) => timestamp > windowStart,
  );

  const success = validTimestamps.length < profile.limit;

  if (success) {
    validTimestamps.push(now);
  }

  if (validTimestamps.length === 0) {
    cache.memoryStore.delete(identifier);
  } else {
    cache.memoryStore.set(identifier, {
      timestamps: validTimestamps,
    });
  }

  const firstTimestamp = validTimestamps[0] ?? now;
  const reset = firstTimestamp + profile.windowMs;
  const remaining = success
    ? Math.max(0, profile.limit - validTimestamps.length)
    : 0;

  return {
    success,
    limit: profile.limit,
    remaining,
    reset,
    headers: buildRateLimitHeaders({
      limit: profile.limit,
      remaining,
      reset,
    }),
    backend: "memory",
  };
}

async function applyDistributedRateLimit(
  identifier: string,
  profile: RateLimitProfile,
): Promise<RateLimitState> {
  const ratelimit = getLimiter(profile);
  const result = await ratelimit.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    headers: buildRateLimitHeaders(result),
    backend: "upstash",
  };
}

export async function checkRateLimit(options: {
  request: Request;
  limiter: RateLimitProfile;
  keyParts?: RateLimitKeyPart[];
  identifier?: string;
}) {
  warnIfUsingMemoryFallback();

  const identifier =
    options.identifier ??
    buildRateLimitIdentifier({
      request: options.request,
      keyParts: options.keyParts,
    });

  if (isDistributedRateLimitEnabled()) {
    return applyDistributedRateLimit(identifier, options.limiter);
  }

  return applyMemoryRateLimit(identifier, options.limiter);
}

export async function enforceRateLimit(options: {
  request: Request;
  limiter: RateLimitProfile;
  keyParts?: RateLimitKeyPart[];
  identifier?: string;
}) {
  const result = await checkRateLimit(options);

  if (!result.success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1_000),
    );

    throw new TooManyRequestsError(options.limiter.message, {
      headers: result.headers,
      retryAfterSeconds,
    });
  }

  return result;
}

export function attachRateLimitHeaders(
  response: Response,
  rateLimitHeaders?: HeadersInit,
) {
  if (!rateLimitHeaders) {
    return response;
  }

  const headers = new Headers(rateLimitHeaders);
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

function createRateLimitProfile(profile: RateLimitProfile) {
  return profile;
}

export const authLimiter = createRateLimitProfile({
  key: "auth",
  limit: 10,
  windowMs: 10 * 60 * 1_000,
  message: "Muitas tentativas de autenticacao. Aguarde antes de tentar novamente.",
});

export const uploadLimiter = createRateLimitProfile({
  key: "upload",
  limit: 10,
  windowMs: 5 * 60 * 1_000,
  message: "Muitos uploads em pouco tempo. Aguarde antes de tentar novamente.",
});

export const mutationLimiter = createRateLimitProfile({
  key: "mutation",
  limit: 30,
  windowMs: 60 * 1_000,
  message: "Muitas mutacoes em pouco tempo. Aguarde antes de tentar novamente.",
});

export const adminLimiter = createRateLimitProfile({
  key: "admin",
  limit: 20,
  windowMs: 60 * 1_000,
  message: "Limite de operacoes administrativas atingido. Aguarde e tente novamente.",
});

export const reportLimiter = createRateLimitProfile({
  key: "report",
  limit: 5,
  windowMs: 5 * 60 * 1_000,
  message: "Muitas exportacoes em pouco tempo. Aguarde antes de tentar novamente.",
});

export const loginLimiter = createRateLimitProfile({
  ...authLimiter,
  key: "login",
  limit: 5,
  windowMs: 10 * 60 * 1_000,
  message: "Muitas tentativas de login. Aguarde alguns minutos para tentar novamente.",
});

export const registerLimiter = createRateLimitProfile({
  ...authLimiter,
  key: "register",
  limit: 5,
  windowMs: 15 * 60 * 1_000,
  message: "Muitos cadastros em pouco tempo. Aguarde antes de tentar novamente.",
});

export const resendVerificationLimiter = createRateLimitProfile({
  ...authLimiter,
  key: "resend-verification",
  limit: 4,
  windowMs: 60 * 60 * 1_000,
  message: "Muitos pedidos de reenvio. Aguarde antes de gerar outro link.",
});

export const forgotPasswordLimiter = createRateLimitProfile({
  ...authLimiter,
  key: "forgot-password",
  limit: 4,
  windowMs: 60 * 60 * 1_000,
  message: "Muitos pedidos de recuperacao. Aguarde antes de tentar novamente.",
});

export const resetPasswordLimiter = createRateLimitProfile({
  ...authLimiter,
  key: "reset-password",
  limit: 5,
  windowMs: 30 * 60 * 1_000,
  message: "Muitas tentativas de redefinir senha. Aguarde antes de tentar novamente.",
});

export const publicReadLimiter = createRateLimitProfile({
  key: "public-read",
  limit: 120,
  windowMs: 60 * 1_000,
  message: "Muitas requisicoes em pouco tempo. Aguarde antes de tentar novamente.",
});

export const pixStatusLimiter = createRateLimitProfile({
  key: "pix-status",
  limit: 60,
  windowMs: 60 * 1_000,
  message: "Muitas consultas de status em pouco tempo. Aguarde antes de tentar novamente.",
});
