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

function getSendUrl(apiUrl) {
  return apiUrl.endsWith("/api/send") ? apiUrl : `${apiUrl}/api/send`;
}

function parseSseEvents(body) {
  return clean(body)
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:")))
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function assertWaSendSuccess(body) {
  const events = parseSseEvents(body);
  const failed = events.find((event) => event?.status === "FAILED" || event?.error);

  if (failed) {
    throw new Error(failed.error || failed.message || "Gagal mengirim WhatsApp");
  }

  const sent = events.find((event) => event?.status === "SENT" || event?.ok === true);

  if (events.length > 0 && !sent) {
    throw new Error("WhatsApp belum mengembalikan status terkirim");
  }
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

export async function sendWaMessage({ chatId, text, source = "kas-amarta-admin-login" }) {
  const { apiUrl, apiKey, sessionId } = getWaConfig();
  const res = await fetch(getSendUrl(apiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      chatId,
      text,
      sessionId,
      source,
    }),
    cache: "no-store",
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(body || "Gagal mengirim WhatsApp");
  }

  assertWaSendSuccess(body);

  return body;
}
