import { logger, serializeError } from "./logger";
import { sendAlert } from "./tracing";

type CaptureContext = {
  source?: string;
  requestId?: string;
  userId?: string;
  extras?: Record<string, unknown>;
};

type CaptureHook = (error: unknown, context: CaptureContext) => void;

type GlobalWithHook = typeof globalThis & {
  __mqtCaptureHook?: CaptureHook;
};

export function registerCaptureHook(hook: CaptureHook) {
  (globalThis as GlobalWithHook).__mqtCaptureHook = hook;
}

export function captureException(error: unknown, context: CaptureContext = {}) {
  logger.error(context.source ?? "unhandled exception", {
    ...context.extras,
    source: context.source,
    requestId: context.requestId,
    userId: context.userId,
    error: serializeError(error),
  });

  const hook = (globalThis as GlobalWithHook).__mqtCaptureHook;
  if (hook) {
    try {
      hook(error, context);
    } catch (hookError) {
      logger.warn("capture hook failed", {
        error: serializeError(hookError),
      });
    }
  }

  void sendAlert({
    level: "error",
    source: context.source ?? "unhandled exception",
    message: error instanceof Error ? error.message : String(error),
    requestId: context.requestId,
    extras: {
      userId: context.userId,
      ...(context.extras ?? {}),
    },
  });
}
