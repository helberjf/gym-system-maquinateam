type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown> | undefined;

type LogEntry = {
  level: LogLevel;
  time: string;
  event: string;
  env: string;
  service: string;
  message?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  meta?: Record<string, unknown>;
};

const SERVICE_NAME = "maquinateam-gym";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getMinLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();

  if (configured && configured in LEVEL_WEIGHT) {
    return configured as LogLevel;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[getMinLevel()];
}

function normalizeError(error: unknown): LogEntry["error"] {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string | number };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: withCode.code,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  try {
    return { name: "Error", message: JSON.stringify(error) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

function buildEntry(
  level: LogLevel,
  event: string,
  payload?: unknown,
): LogEntry {
  const entry: LogEntry = {
    level,
    time: new Date().toISOString(),
    event,
    env: process.env.NODE_ENV ?? "development",
    service: SERVICE_NAME,
  };

  if (payload === undefined || payload === null) {
    return entry;
  }

  if (payload instanceof Error) {
    entry.error = normalizeError(payload);
    entry.message = payload.message;
    return entry;
  }

  if (typeof payload === "string") {
    entry.message = payload;
    return entry;
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (record.error instanceof Error) {
      entry.error = normalizeError(record.error);
      const { error: _ignored, ...rest } = record;
      if (Object.keys(rest).length > 0) {
        entry.meta = rest;
      }
      return entry;
    }

    entry.meta = record;
    return entry;
  }

  entry.meta = { value: payload };
  return entry;
}

function write(level: LogLevel, event: string, payload?: unknown) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = buildEntry(level, event, payload);
  const line = JSON.stringify(entry);
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = {
  debug(event: string, payload?: unknown) {
    write("debug", event, payload);
  },
  info(event: string, payload?: unknown) {
    write("info", event, payload);
  },
  warn(event: string, payload?: unknown) {
    write("warn", event, payload);
  },
  error(event: string, payload?: unknown) {
    write("error", event, payload);
  },
  child(context: Record<string, unknown>) {
    return {
      debug: (event: string, payload?: unknown) =>
        write("debug", event, mergeMeta(context, payload)),
      info: (event: string, payload?: unknown) =>
        write("info", event, mergeMeta(context, payload)),
      warn: (event: string, payload?: unknown) =>
        write("warn", event, mergeMeta(context, payload)),
      error: (event: string, payload?: unknown) =>
        write("error", event, mergeMeta(context, payload)),
    };
  },
};

function mergeMeta(context: Record<string, unknown>, payload?: unknown) {
  if (payload === undefined || payload === null) {
    return context;
  }

  if (payload instanceof Error) {
    return { ...context, error: payload };
  }

  if (typeof payload === "object") {
    return { ...context, ...(payload as Record<string, unknown>) };
  }

  return { ...context, value: payload };
}
