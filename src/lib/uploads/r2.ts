import "server-only";

import crypto from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ServiceUnavailableError } from "@/lib/errors";
import { sanitizeFilename } from "@/lib/validators";

type UploadToR2Input = {
  body: Buffer;
  contentType: string;
  filename: string;
  prefix?: string;
};

function getPublicBaseUrl() {
  return (
    process.env.R2_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ??
    ""
  ).replace(/\/+$/, "");
}

function getR2Endpoint() {
  if (process.env.R2_ENDPOINT) {
    return process.env.R2_ENDPOINT;
  }

  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return "";
}

function getR2Config() {
  const endpoint = getR2Endpoint();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucketName = process.env.R2_BUCKET_NAME ?? "";
  const publicBaseUrl = getPublicBaseUrl();

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    throw new ServiceUnavailableError(
      "Cloudflare R2 nao configurado. Defina R2_ENDPOINT ou R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.",
    );
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
  };
}

let cachedClient: S3Client | null = null;

function getR2Client() {
  if (!cachedClient) {
    const config = getR2Config();
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

function buildObjectKey(prefix: string, filename: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeFilename = sanitizeFilename(filename);
  const uniqueSuffix = crypto.randomBytes(8).toString("hex");

  return `${prefix}/${year}/${month}/${Date.now()}-${uniqueSuffix}-${safeFilename}`;
}

export async function uploadToR2(input: UploadToR2Input) {
  const config = getR2Config();
  const client = getR2Client();
  const key = buildObjectKey(input.prefix ?? "uploads", input.filename);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    storageKey: key,
    url: `${config.publicBaseUrl}/${key}`,
  };
}

export async function deleteFromR2(storageKey?: string | null) {
  if (!storageKey) {
    return;
  }

  const config = getR2Config();
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
    }),
  );
}
