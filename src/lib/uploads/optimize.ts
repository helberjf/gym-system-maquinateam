import "server-only";

import sharp from "sharp";

type OptimizeImageInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export type OptimizedImage = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  sizeBytes: number;
};

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_MAX_HEIGHT = 1600;
const DEFAULT_QUALITY = 82;

function replaceExtension(filename: string, nextExtension: string) {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot === -1 ? filename : filename.slice(0, lastDot);
  return `${base}.${nextExtension}`;
}

export async function optimizeProductImage(
  input: OptimizeImageInput,
): Promise<OptimizedImage> {
  if (!input.mimeType.startsWith("image/")) {
    return {
      buffer: input.buffer,
      mimeType: input.mimeType,
      filename: input.filename,
      sizeBytes: input.buffer.byteLength,
    };
  }

  const maxWidth = input.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = input.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const quality = input.quality ?? DEFAULT_QUALITY;

  const optimized = await sharp(input.buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  return {
    buffer: optimized,
    mimeType: "image/webp",
    filename: replaceExtension(input.filename, "webp"),
    sizeBytes: optimized.byteLength,
  };
}
