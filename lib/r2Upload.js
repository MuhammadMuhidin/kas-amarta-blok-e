import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getIntegrationConfigString } from "@/lib/integrationConfig";
import {
  validateActivityImageFile,
  validatePaymentProofFile,
  validateReceiptFile,
} from "@/lib/storage";

function getEnv(name, fallbackName = "") {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : "");
}

async function getR2Config() {
  const [bucket, publicUrl] = await Promise.all([
    getIntegrationConfigString("R2_BUCKET_NAME"),
    getIntegrationConfigString("R2_PUBLIC_URL"),
  ]);
  const accountId = getEnv("R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error("Konfigurasi R2 belum lengkap");
  }

  return {
    bucket,
    publicUrl: publicUrl.replace(/\/$/, ""),
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

function sanitizeFileName(name = "file") {
  const cleaned = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "file";
}

export async function uploadR2Object(file, { keyPrefix, fileNamePrefix = "file" }) {
  const { bucket, publicUrl, client } = await getR2Config();
  const dateKey = new Date().toISOString().slice(0, 10);
  const key = `${keyPrefix}/${dateKey}/${fileNamePrefix}-${randomUUID()}-${sanitizeFileName(file.name)}`;
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
    url: `${publicUrl}/${key}`,
  };
}

export async function uploadCashflowReceipt(file, { cashflowId }) {
  validateReceiptFile(file);

  return uploadR2Object(file, {
    keyPrefix: "cashflow-receipts",
    fileNamePrefix: cashflowId,
  });
}

export async function uploadPaymentProof(file, { proofId }) {
  validatePaymentProofFile(file);

  return uploadR2Object(file, {
    keyPrefix: "payment-proofs",
    fileNamePrefix: proofId,
  });
}

export async function uploadActivityImage(file, { postId = "activity" } = {}) {
  validateActivityImageFile(file);

  return uploadR2Object(file, {
    keyPrefix: "activity-images",
    fileNamePrefix: postId,
  });
}
