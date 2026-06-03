const ALERT_EMAIL_ENABLED = String(process.env.ALERT_EMAIL_ENABLED || "").toLowerCase() === "true";
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "";
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "";

function splitRecipients(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSource(source) {
  return String(source || "admin-alert")
    .replace(/^admin-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildAlertSubject({ source, period, subject }) {
  if (subject) return String(subject).trim();

  const sourceLabel = formatSource(source);
  const periodLabel = period && period !== "-" ? ` - ${period}` : "";

  return `[ADMIN ALERT] ${sourceLabel}${periodLabel}`;
}

function buildAlertBody({ message, source, period }) {
  return [
    "Admin alert from Amarta Residence Block E Cash System.",
    "",
    `Source: ${source || "admin"}`,
    `Period: ${period || "-"}`,
    "",
    "Message:",
    String(message || "-"),
    "",
    "---",
    "This email was sent automatically.",
  ].join("\n");
}

export function getEmailAlertDefaults() {
  return {
    enabled: ALERT_EMAIL_ENABLED,
    to: splitRecipients(ALERT_EMAIL_TO),
    from: ALERT_EMAIL_FROM,
    provider: "resend",
  };
}

export async function sendAlertEmail({ message, source = "admin", period = "-", subject } = {}) {
  if (!ALERT_EMAIL_ENABLED) {
    return { ok: false, skipped: true, reason: "Email alert is disabled" };
  }

  const to = splitRecipients(ALERT_EMAIL_TO);

  if (!RESEND_API_KEY) {
    return { ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" };
  }

  if (!ALERT_EMAIL_FROM) {
    return { ok: false, skipped: true, reason: "ALERT_EMAIL_FROM is not configured" };
  }

  if (to.length === 0) {
    return { ok: false, skipped: true, reason: "ALERT_EMAIL_TO is not configured" };
  }

  if (!String(message || "").trim()) {
    return { ok: false, skipped: true, reason: "Email alert message is empty" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM,
      to,
      subject: buildAlertSubject({ source, period, subject }),
      text: buildAlertBody({ message, source, period }),
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
    throw new Error(`Failed to send email alert (${response.status}): ${responseText}`);
  }

  return {
    ok: true,
    provider: "resend",
    to,
    id: data?.id || null,
  };
}