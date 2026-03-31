import { z, type ZodTypeAny } from "zod";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationAppError,
} from "@/lib/errors";

export * from "@/lib/validators/auth";
export * from "@/lib/validators/billing";
export * from "@/lib/validators/commerce";
export * from "@/lib/validators/operations";
export * from "@/lib/validators/reports";
export * from "@/lib/validators/training";

type UploadValidationOptions = {
  allowedMimeTypes: string[];
  allowedExtensions?: string[];
  maxSizeBytes: number;
};

export function validateWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationAppError(
      parsed.error.issues[0]?.message ?? "Dados invalidos.",
      parsed.error.issues,
    );
  }

  return parsed.data;
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throw new BadRequestError("Corpo JSON invalido.");
  }

  return validateWithSchema(schema, json);
}

export function parseSearchParams<TSchema extends ZodTypeAny>(
  input: URLSearchParams | Record<string, unknown>,
  schema: TSchema,
) {
  const value =
    input instanceof URLSearchParams
      ? Object.fromEntries(input.entries())
      : input;

  return validateWithSchema(schema, value);
}

export function sanitizeFilename(filename: string) {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `upload-${Date.now()}`;
}

export function validateUploadFile(
  file: File | null | undefined,
  options: UploadValidationOptions,
) {
  if (!file) {
    throw new BadRequestError("Nenhum arquivo enviado.");
  }

  if (file.size <= 0) {
    throw new BadRequestError("Arquivo vazio.");
  }

  if (file.size > options.maxSizeBytes) {
    throw new PayloadTooLargeError("Arquivo maior que o permitido.");
  }

  if (!options.allowedMimeTypes.includes(file.type)) {
    throw new UnsupportedMediaTypeError("Tipo de arquivo nao permitido.");
  }

  const safeFilename = sanitizeFilename(file.name);
  const extension = safeFilename.includes(".")
    ? safeFilename.split(".").pop()?.toLowerCase() ?? ""
    : "";

  if (
    options.allowedExtensions &&
    !options.allowedExtensions.includes(extension)
  ) {
    throw new UnsupportedMediaTypeError(
      "Extensao de arquivo nao permitida.",
    );
  }

  return {
    file,
    safeFilename,
    extension,
    sizeBytes: file.size,
    mimeType: file.type,
  };
}
