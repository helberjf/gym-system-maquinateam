import { uploadToR2 } from "@/lib/uploads/r2";
import { optimizeProductImage } from "@/lib/uploads/optimize";
import { handleRouteError, successResponse } from "@/lib/errors";
import { requireApiPermission } from "@/lib/permissions";
import {
  attachRateLimitHeaders,
  enforceRateLimit,
  uploadLimiter,
} from "@/lib/rate-limit";
import {
  MAX_PRODUCT_IMAGES,
  PRODUCT_IMAGE_ALLOWED_EXTENSIONS,
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
} from "@/lib/commerce/constants";
import { BadRequestError } from "@/lib/errors";
import { validateUploadFile } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rateLimitHeaders: Headers | undefined;

  try {
    const session = await requireApiPermission("manageProducts");
    const rateLimit = await enforceRateLimit({
      request,
      limiter: uploadLimiter,
      keyParts: [session.user.id, "product-images"],
    });
    rateLimitHeaders = rateLimit.headers;

    const formData = await request.formData();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(
      (value): value is File => value instanceof File,
    );

    if (files.length === 0) {
      throw new BadRequestError("Envie ao menos uma imagem.");
    }

    if (files.length > MAX_PRODUCT_IMAGES) {
      throw new BadRequestError(
        `Envie no maximo ${MAX_PRODUCT_IMAGES} imagem(ns) por vez.`,
      );
    }

    const images = await Promise.all(
      files.map(async (file) => {
        const validated = validateUploadFile(file, {
          allowedMimeTypes: [...PRODUCT_IMAGE_ALLOWED_MIME_TYPES],
          allowedExtensions: [...PRODUCT_IMAGE_ALLOWED_EXTENSIONS],
          maxSizeBytes: PRODUCT_IMAGE_MAX_SIZE_BYTES,
        });
        const rawBuffer = Buffer.from(await validated.file.arrayBuffer());
        const optimized = await optimizeProductImage({
          buffer: rawBuffer,
          mimeType: validated.mimeType,
          filename: validated.safeFilename,
        });
        const uploaded = await uploadToR2({
          body: optimized.buffer,
          contentType: optimized.mimeType,
          filename: optimized.filename,
          prefix: "products",
        });

        return {
          url: uploaded.url,
          storageKey: uploaded.storageKey,
          mimeType: optimized.mimeType,
          sizeBytes: optimized.sizeBytes,
        };
      }),
    );

    return attachRateLimitHeaders(
      successResponse({
        images,
        message: "Upload concluido com sucesso.",
      }),
      rateLimitHeaders,
    );
  } catch (error) {
    return handleRouteError(error, {
      source: "product images upload route",
      headers: rateLimitHeaders,
    });
  }
}
