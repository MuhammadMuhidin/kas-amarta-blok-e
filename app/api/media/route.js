import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { normalizeMediaKey } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getEnv(name, fallbackName = "") {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : "");
}

function getR2Config() {
  const accountId = getEnv("R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = getEnv("R2_BUCKET_NAME", "CLOUDFLARE_R2_BUCKET_NAME");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Konfigurasi media storage belum lengkap");
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

function getContentType(metadata = {}, key = "") {
  if (metadata.ContentType) return metadata.ContentType;

  if (/\.jpe?g(?:$|\?)/i.test(key)) return "image/jpeg";
  if (/\.png(?:$|\?)/i.test(key)) return "image/png";
  if (/\.webp(?:$|\?)/i.test(key)) return "image/webp";
  if (/\.pdf(?:$|\?)/i.test(key)) return "application/pdf";

  return "application/octet-stream";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = normalizeMediaKey(searchParams.get("key") || "");

    if (!key) {
      return NextResponse.json({ error: "Media tidak valid" }, { status: 400 });
    }

    const { bucket, client } = getR2Config();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    if (!object.Body) {
      return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", getContentType(object, key));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    if (object.ContentLength) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);

    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (err) {
    console.error("MEDIA ERROR:", err);
    return NextResponse.json({ error: "Gagal memuat media" }, { status: 500 });
  }
}
