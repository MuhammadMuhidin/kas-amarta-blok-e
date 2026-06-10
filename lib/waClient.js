function clean(value) {
  return String(value || "").trim();
}

function getWaConfig() {
  const apiUrl = clean(process.env.WA_API_URL).replace(/\/$/, "");
  const apiKey = clean(process.env.WA_API_KEY);
  const sessionId = clean(process.env.WA_SESSION_ID) || "main";

  if (!apiUrl) throw new Error("WA_API_URL belum dikonfigurasi");
  if (!apiKey) throw new Error("WA_API_KEY belum dikonfigurasi");

  return { apiUrl, apiKey, sessionId };
}

export function normalizePhoneToWaChatId(phone) {
  const digits = clean(phone).replace(/\D/g, "");

  if (!digits) throw new Error("Nomor WhatsApp belum dikonfigurasi");

  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;

  if (!normalized.startsWith("62")) {
    throw new Error("Nomor WhatsApp harus menggunakan format 62");
  }

  return `${normalized}@s.whatsapp.net`;
}

export async function sendWaMessage({ chatId, text }) {
  const { apiUrl, apiKey, sessionId } = getWaConfig();
  const res = await fetch(`${apiUrl}/api/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      chatId,
      text,
      sessionId,
      source: "kas-amarta-admin-login",
    }),
    cache: "no-store",
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(body || "Gagal mengirim WhatsApp");
  }

  return body;
}
