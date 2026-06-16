import { getLatestReceiptUrl } from "@/features/health/receiptStorageRepository";
import { getIntegrationConfigString } from "@/lib/integrationConfig";

const RECEIPT_PREFIX = "/cashflow-receipts/";
const CHECK_TIMEOUT_MS = 5000;

async function normalizeReceiptUrl(value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return null;

  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("URL nota harus menggunakan HTTPS");
  }
  if (!url.pathname.startsWith(RECEIPT_PREFIX)) {
    throw new Error("Path nota tidak valid");
  }

  const configuredPublicUrl = await getIntegrationConfigString("R2_PUBLIC_URL");
  if (configuredPublicUrl) {
    const configured = new URL(configuredPublicUrl);
    if (url.hostname !== configured.hostname) {
      throw new Error("Host nota tidak sesuai konfigurasi R2 public URL");
    }
  } else if (!url.hostname.startsWith("pub-") || !url.hostname.endsWith(".r2.dev")) {
    throw new Error("Host nota tidak valid");
  }

  return url;
}

async function testPublicReceiptAccess(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });

    return {
      reachable: res.ok || res.status === 206,
      statusCode: res.status,
      contentType: res.headers.get("content-type") || "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkReceiptStorageHealth() {
  const receiptUrl = await getLatestReceiptUrl();
  if (!receiptUrl) {
    return {
      ok: true,
      status: "no_sample",
      message: "Belum ada sample receipt_url untuk dicek otomatis.",
    };
  }

  const url = await normalizeReceiptUrl(receiptUrl);
  const result = await testPublicReceiptAccess(url);

  if (!result.reachable) {
    return {
      ok: false,
      status: "unreachable",
      status_code: result.statusCode,
      host: url.hostname,
      path: url.pathname,
      message: "R2 public receipt tidak bisa diakses.",
    };
  }

  return {
    ok: true,
    status: "reachable",
    status_code: result.statusCode,
    content_type: result.contentType,
    host: url.hostname,
    path: url.pathname,
    message: "R2 public receipt bisa diakses.",
  };
}

export function getReceiptStorageErrorResponse(error) {
  const message = error.name === "AbortError"
    ? "R2 public receipt timeout. Kemungkinan sedang lambat atau gangguan sementara."
    : error.message || "Gagal mengecek R2 public receipt.";

  return {
    ok: false,
    status: "error",
    message,
  };
}
