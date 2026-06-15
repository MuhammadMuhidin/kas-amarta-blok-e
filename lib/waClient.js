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
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk
      .split(/\r?\n/)
      .filter((line) => line.trim().startsWith("data:"))
      .map((line) => line.trim().slice(5).trim())
      .join("\n"))
    .filter(Boolean)
    .map((data) => {
      try {
        return JSON.parse(data);
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

function buildPayload({ chatId, text, sessionId, source, phoneNumber, pairType }) {
  const normalizedPhone = clean(phoneNumber);
  const normalizedPairType = clean(pairType).toUpperCase();
  const pairingCodeMode = normalizedPairType === "CODE";

  return {
    chatId,
    text,
    sessionId,
    source,
    ...(normalizedPhone ? {
      phoneNumber: normalizedPhone,
      phone: normalizedPhone,
      pairingNumber: normalizedPhone,
    } : {}),
    ...(normalizedPairType ? {
      pairType: normalizedPairType,
      pairingType: normalizedPairType,
      pairingMode: normalizedPairType,
      usePairingCode: pairingCodeMode,
    } : {}),
  };
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

export async function openWaMessageStream({
  chatId,
  text,
  source = "kas-amarta-admin-login",
  phoneNumber = "",
  pairType = "",
}) {
  const { apiUrl, apiKey, sessionId } = getWaConfig();
  const response = await fetch(getSendUrl(apiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildPayload({
      chatId,
      text,
      sessionId,
      source,
      phoneNumber,
      pairType,
    })),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Gagal mengirim WhatsApp");
  }

  return { response, sessionId };
}

export async function sendWaMessage({ chatId, text, source = "kas-amarta-admin-login" }) {
  const { response } = await openWaMessageStream({ chatId, text, source });
  const body = await response.text();
  assertWaSendSuccess(body);
  return body;
}
