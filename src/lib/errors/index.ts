import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";
import { captureException } from "@/lib/observability/capture";

type ErrorDetails =
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null
  | undefined;

type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetails;
  expose?: boolean;
  headers?: HeadersInit;
  cause?: unknown;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;
  readonly expose: boolean;
  readonly headers?: HeadersInit;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? true;
    this.headers = options.headers;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisicao invalida.", details?: ErrorDetails) {
    super({
      statusCode: 400,
      code: "bad_request",
      message,
      details,
    });
  }
}

export class ValidationAppError extends AppError {
  constructor(message = "Dados invalidos.", issues?: ZodIssue[]) {
    super({
      statusCode: 400,
      code: "validation_error",
      message,
      details: issues ? formatZodIssues(issues) : undefined,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Nao autorizado.") {
    super({
      statusCode: 401,
      code: "unauthorized",
      message,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.") {
    super({
      statusCode: 403,
      code: "forbidden",
      message,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado.") {
    super({
      statusCode: 404,
      code: "not_found",
      message,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito ao processar a solicitacao.") {
    super({
      statusCode: 409,
      code: "conflict",
      message,
    });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "Tipo de arquivo nao permitido.") {
    super({
      statusCode: 415,
      code: "unsupported_media_type",
      message,
    });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Arquivo maior que o permitido.") {
    super({
      statusCode: 413,
      code: "payload_too_large",
      message,
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Servico temporariamente indisponivel.") {
    super({
      statusCode: 503,
      code: "service_unavailable",
      message,
    });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = "Muitas tentativas. Aguarde antes de tentar novamente.",
    options?: {
      headers?: HeadersInit;
      retryAfterSeconds?: number;
      details?: ErrorDetails;
    },
  ) {
    const headers = new Headers(options?.headers);

    if (options?.retryAfterSeconds) {
      headers.set("Retry-After", String(options.retryAfterSeconds));
    }

    super({
      statusCode: 429,
      code: "rate_limited",
      message,
      details: options?.details,
      headers,
    });
  }
}

export function formatZodIssues(issues: ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationAppError(
      error.issues[0]?.message ?? "Dados invalidos.",
      error.issues,
    );
  }

  return new AppError({
    statusCode: 500,
    code: "internal_error",
    message: "Nao foi possivel processar sua solicitacao.",
    expose: false,
    cause: error,
  });
}

export function mergeHeaders(...headersList: Array<HeadersInit | undefined>) {
  const merged = new Headers();

  for (const headerSource of headersList) {
    if (!headerSource) {
      continue;
    }

    const current = new Headers(headerSource);
    current.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

export function attachHeaders(response: Response, headers?: HeadersInit) {
  if (!headers) {
    return response;
  }

  const nextHeaders = new Headers(headers);
  nextHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export function successResponse<T extends Record<string, unknown>>(
  payload?: T,
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      ok: true,
      ...(payload ?? {}),
    },
    init,
  );
}

export function errorResponse(
  error: unknown,
  init?: {
    headers?: HeadersInit;
    overrideStatus?: number;
  },
) {
  const normalizedError = normalizeError(error);
  const headers = mergeHeaders(normalizedError.headers, init?.headers);

  return NextResponse.json(
    {
      ok: false,
      error: normalizedError.expose
        ? normalizedError.message
        : "Erro interno do servidor.",
      code: normalizedError.code,
      details: normalizedError.details ?? null,
    },
    {
      status: init?.overrideStatus ?? normalizedError.statusCode,
      headers,
    },
  );
}

export function handleRouteError(
  error: unknown,
  context?: {
    source?: string;
    headers?: HeadersInit;
  },
) {
  const isAppError = error instanceof AppError;
  const shouldCapture =
    !isAppError || (isAppError && error.statusCode >= 500);

  if (shouldCapture) {
    captureException(error, { source: context?.source ?? "route_error" });
  }

  return errorResponse(error, {
    headers: context?.headers,
  });
}
