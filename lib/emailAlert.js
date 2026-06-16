import { isEmailNotificationsEnabled } from "@/lib/appConfig";
import {
  getIntegrationConfigString,
  getIntegrationConfigStringArray,
} from "@/lib/integrationConfig";
import { formatJakartaDateTime } from "@/lib/localDate";

const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "";
const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const sources = {
  admin: "Admin",
  "admin-test-alert": "Uji Notifikasi Sistem",
  "payment-proof-upload": "Bukti Pembayaran",
  web: "Aplikasi",
  system: "Sistem",
};

const clean = (value) => String(value || "").trim();

function periodLabel(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(clean(value));
  if (!match) return clean(value) || "-";
  const month = months[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : clean(value);
}

function sourceLabel(value) {
  const key = clean(value).toLowerCase() || "admin";
  return sources[key] || key
    .replace(/^admin-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function subjectOf({ source, period, subject }) {
  if (clean(subject)) return clean(subject);
  const suffix = clean(period) && period !== "-" ? ` - ${periodLabel(period)}` : "";
  return `[Amarta Kas] ${sourceLabel(source)}${suffix}`;
}

function bodyOf(message) {
  return [
    clean(message) || "Notifikasi sistem tidak memiliki isi.",
    "",
    `Dikirim: ${formatJakartaDateTime(new Date().toISOString(), "id-ID")} WIB`,
    "",
    "Email ini dikirim otomatis oleh Sistem Kas Amarta Residence Blok E.",
  ].join("\n");
}

async function getEmailRuntimeConfig() {
  const [to, from, r2PublicUrl, appBaseUrl] = await Promise.all([
    getIntegrationConfigStringArray("ALERT_EMAIL_TO"),
    getIntegrationConfigString("ALERT_EMAIL_FROM"),
    getIntegrationConfigString("R2_PUBLIC_URL"),
    getIntegrationConfigString("APP_URL"),
  ]);

  return {
    to,
    from,
    r2PublicUrl,
    appBaseUrl,
  };
}

function attachmentPath(value, { r2PublicUrl, appBaseUrl }) {
  const path = clean(value);
  if (path.startsWith("https://")) return path;

  try {
    const parsed = new URL(path, "https://amarta.local");
    const key = clean(parsed.searchParams.get("key"));
    if (key && clean(r2PublicUrl)) {
      return `${clean(r2PublicUrl).replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
    }
  } catch {
    // Ignore invalid attachment URLs and continue with application path fallback.
  }

  if (path.startsWith("/") && clean(appBaseUrl)) {
    return `${clean(appBaseUrl).replace(/\/$/, "")}${path}`;
  }
  return "";
}

function filesOf(value, config) {
  return Array.isArray(value)
    ? value
        .map((item) => ({
          path: attachmentPath(item?.path, config),
          filename: clean(item?.filename) || "lampiran",
        }))
        .filter((item) => item.path)
    : [];
}

export function getEmailAlertDefaults() {
  return {
    enabled: String(process.env.EMAIL_NOTIFICATIONS_ENABLED || process.env.ALERT_EMAIL_ENABLED || "")
      .toLowerCase() === "true",
    to: clean(process.env.ALERT_EMAIL_TO).split(",").map((item) => item.trim()).filter(Boolean),
    from: process.env.ALERT_EMAIL_FROM || "",
    provider: "resend",
  };
}

export async function sendAlertEmail({
  message,
  source = "admin",
  period = "-",
  subject,
  attachments = [],
} = {}) {
  try {
    if (!(await isEmailNotificationsEnabled())) {
      return { ok: false, skipped: true, reason: "Email Notifications dinonaktifkan dari Settings" };
    }
  } catch (error) {
    console.error("Gagal membaca toggle Email Notifications", error);
    return { ok: false, skipped: true, reason: "Konfigurasi Email Notifications tidak tersedia" };
  }

  const config = await getEmailRuntimeConfig();
  if (!apiKey) return { ok: false, skipped: true, reason: "RESEND_API_KEY belum dikonfigurasi" };
  if (!config.from) return { ok: false, skipped: true, reason: "ALERT_EMAIL_FROM belum dikonfigurasi" };
  if (!config.to.length) return { ok: false, skipped: true, reason: "ALERT_EMAIL_TO belum dikonfigurasi" };
  if (!clean(message)) return { ok: false, skipped: true, reason: "Isi notifikasi email kosong" };

  const files = filesOf(attachments, config);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: config.to,
        subject: subjectOf({ source, period, subject }),
        text: bodyOf(message),
        ...(files.length ? { attachments: files } : {}),
      }),
    });

    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      const error = `Gagal mengirim notifikasi email (${response.status}): ${responseText}`;
      console.error(error);
      return { ok: false, skipped: false, error, provider: "resend" };
    }

    return {
      ok: true,
      provider: "resend",
      to: config.to,
      id: data?.id || null,
      attachment_count: files.length,
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : "Gagal mengirim notifikasi email";
    console.error("Gagal mengirim notifikasi email", error);
    return { ok: false, skipped: false, error: text, provider: "resend" };
  }
}
