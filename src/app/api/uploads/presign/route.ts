import { z } from "zod";
import { createPresignedUploadUrl } from "@/lib/uploads/r2";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  uploadLimiter,
} from "@/lib/rate-limit";
import {
  PRODUCT_IMAGE_ALLOWED_EXTENSIONS,
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
  MAX_PRODUCT_IMAGES,
} from "@/lib/commerce/constants";
import { BadRequestError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/validators";

export const runtime = "nodejs";

const presignSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().trim().min(1, "Nome de arquivo obrigatorio."),
        contentType: z.string().trim().min(1, "Tipo de conteudo obrigatorio."),
        sizeBytes: z.number().int().positive("Tamanho invalido."),
      }),
    )
    .min(1, "Envie ao menos um arquivo.")
    .max(MAX_PRODUCT_IMAGES, `Maximo de ${MAX_PRODUCT_IMAGES} arquivos por vez.`),
  prefix: z.string().trim().default("products"),
});

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageProducts");
    const rateLimit = await enforceRateLimit({
      request,
      limiter: uploadLimiter,
      keyParts: [session.user.id, "product-images-presign"],
    });
    rateLimitHeaders = rateLimit.headers;

    const input = await parseJsonBody(request, presignSchema);

    for (const file of input.files) {
      if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(file.contentType as typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES[number])) {
        throw new BadRequestError(
          `Tipo de arquivo nao permitido: ${file.contentType}.`,
        );
      }

      const extension = file.filename.split(".").pop()?.toLowerCase() ?? "";

      if (!PRODUCT_IMAGE_ALLOWED_EXTENSIONS.includes(extension as typeof PRODUCT_IMAGE_ALLOWED_EXTENSIONS[number])) {
        throw new BadRequestError(
          `Extensao de arquivo nao permitida: ${extension}.`,
        );
      }

      if (file.sizeBytes > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
        throw new BadRequestError(
          `Arquivo ${file.filename} maior que o limite permitido.`,
        );
      }
    }

    const presignedFiles = await Promise.all(
      input.files.map((file) =>
        createPresignedUploadUrl({
          filename: file.filename,
          contentType: file.contentType,
          prefix: input.prefix,
          contentLength: file.sizeBytes,
        }),
      ),
    );

    return attachRateLimitHeaders(
      successResponse({
        files: presignedFiles,
        message: "URLs de upload geradas com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "product images presign route",
      headers: rateLimitHeaders,
    });
  }
}
