import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getReceiptPublicUrl, validateReceiptFile } from "@/lib/storage";

function getEnv(name, fallbackName = "") {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : "");
}

function getR2Config() {
  const accountId = getEnv("R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = getEnv("R2_BUCKET_NAME", "CLOUDFLARE_R2_BUCKET_NAME");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Konfigurasi R2 belum lengkap");
  }

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

function sanitizeFileName(name = "receipt") {
  const cleaned = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "receipt";
}

export async function uploadCashflowReceipt(file, { cashflowId }) {
  validateReceiptFile(file);

  const { bucket, client } = getR2Config();
  const dateKey = new Date().toISOString().slice(0, 10);
  const key = `cashflow-receipts/${dateKey}/${cashflowId}-${randomUUID()}-${sanitizeFileName(file.name)}`;
  const body = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.type || "application/octet-stream",
    }),
  );

  return {
    key,
    url: getReceiptPublicUrl(key),
  };
}
