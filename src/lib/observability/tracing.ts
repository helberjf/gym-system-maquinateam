import { logger, serializeError } from "./logger";

type TraceContext = {
  traceId: string;
  source: string;
  startedAt: number;
};

type AlertPayload = {
  level: "warning" | "error";
  source: string;
  message: string;
  traceId?: string;
  requestId?: string;
  extras?: Record<string, unknown>;
};

function createTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getAlertWebhookUrl() {
  return process.env.ALERT_WEBHOOK_URL?.trim() ?? "";
}

export function startTrace(source: string, extras?: Record<string, unknown>): TraceContext {
  const trace: TraceContext = {
    traceId: createTraceId(),
    source,
    startedAt: Date.now(),
  };

  logger.info("trace start", {
    traceId: trace.traceId,
    source,
    ...(extras ?? {}),
  });

  return trace;
}

export function finishTrace(
  trace: TraceContext,
  extras?: Record<string, unknown>,
) {
  logger.info("trace finish", {
    traceId: trace.traceId,
    source: trace.source,
    durationMs: Date.now() - trace.startedAt,
    ...(extras ?? {}),
  });
}

export function failTrace(
  trace: TraceContext,
  error: unknown,
  extras?: Record<string, unknown>,
) {
  logger.error("trace failed", {
    traceId: trace.traceId,
    source: trace.source,
    durationMs: Date.now() - trace.startedAt,
    error: serializeError(error),
    ...(extras ?? {}),
  });
}

export async function withTrace<T>(
  source: string,
  handler: (trace: TraceContext) => Promise<T>,
  extras?: Record<string, unknown>,
) {
  const trace = startTrace(source, extras);

  try {
    const result = await handler(trace);
    finishTrace(trace);
    return result;
  } catch (error) {
    failTrace(trace, error);
    throw error;
  }
}

export async function sendAlert(payload: AlertPayload) {
  const url = getAlertWebhookUrl();
  if (!url) {
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        app: process.env.NEXT_PUBLIC_APP_NAME ?? "Maquina Team",
        env: process.env.NODE_ENV ?? "development",
        ts: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.warn("alert delivery failed", {
      error: serializeError(error),
      source: payload.source,
      traceId: payload.traceId,
    });
  }
}
