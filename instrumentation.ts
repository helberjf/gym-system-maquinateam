import { registerCaptureHook } from "@/lib/observability/capture";
import { logger } from "@/lib/observability/logger";

// Next.js runs this once per server bootstrap (Node + Edge runtimes).
// Ref: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    logger.info("observability ready", { sentry: "disabled" });
    return;
  }

  // Wire Sentry (or any other backend) here without bloating the main bundle.
  // Example when @sentry/nextjs is installed:
  //
  //   const Sentry = await import("@sentry/nextjs");
  //   Sentry.init({ dsn, tracesSampleRate: 0.1 });
  //   registerCaptureHook((error, context) => {
  //     Sentry.withScope((scope) => {
  //       if (context.userId) scope.setUser({ id: context.userId });
  //       if (context.requestId) scope.setTag("request_id", context.requestId);
  //       if (context.source) scope.setTag("source", context.source);
  //       if (context.extras) scope.setExtras(context.extras);
  //       Sentry.captureException(error);
  //     });
  //   });

  registerCaptureHook(() => {
    // Placeholder hook: logger.ts already captured structured error output.
    // Replace this block after installing @sentry/nextjs (see commented code above).
  });

  logger.info("observability ready", { sentry: "configured" });
}
