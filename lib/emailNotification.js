const RESEND_API_URL = "https://api.resend.com/emails";

function normalize(value) {
  return String(value || "").trim();
}

function splitRecipients(value) {
  return normalize(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEmailConfig() {
  const apiKey = normalize(process.env.RESEND_API_KEY);
  const from = normalize(process.env.EMAIL_FROM || process.env.RESEND_EMAIL_FROM);
  const adminRecipients = splitRecipients(
    process.env.PAYMENT_PROOF_NOTIFY_EMAIL ||
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ADMIN_EMAIL,
  );

  return { apiKey, from, adminRecipients };
}

export function isEmailNotificationConfigured() {
  const { apiKey, from, adminRecipients } = getEmailConfig();
  return Boolean(apiKey && from && adminRecipients.length > 0);
}

export async function sendAdminEmailNotification({ subject, text, html }) {
  const { apiKey, from, adminRecipients } = getEmailConfig();

  if (!apiKey || !from || adminRecipients.length === 0) {
    return { ok: false, skipped: true, reason: "email_not_configured" };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: adminRecipients,
      subject,
      text,
      html,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Gagal mengirim email notifikasi");
  }

  return { ok: true, data };
}
