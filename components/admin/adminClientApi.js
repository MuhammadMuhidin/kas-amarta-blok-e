export function getCookieValue(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function buildRequestError({ path, method = "GET", res, data, rawText }) {
  const responseMessage = data?.error || data?.message;
  if (responseMessage) return responseMessage;

  const safeRawText = String(rawText || "").trim();
  if (safeRawText) {
    return `${method} ${path} gagal (${res.status} ${res.statusText || "HTTP Error"}): ${safeRawText.slice(0, 180)}`;
  }

  return `${method} ${path} gagal tanpa response JSON (${res.status} ${res.statusText || "HTTP Error"})`;
}

async function parseResponsePayload({ path, method = "GET", res }) {
  const rawText = await res.text();
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return { data: null, rawText: "" };
  }

  try {
    return { data: JSON.parse(trimmedText), rawText };
  } catch {
    if (res.ok) {
      throw new Error(`${method} ${path} berhasil tetapi response bukan JSON valid`);
    }

    return { data: null, rawText };
  }
}

export async function readJson(path) {
  const method = "GET";
  const res = await fetch(path, { cache: "no-store" });
  const { data, rawText } = await parseResponsePayload({ path, method, res });

  if (!res.ok) {
    throw new Error(buildRequestError({ path, method, res, data, rawText }));
  }

  return data;
}

export async function sendJson(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookieValue("csrf_token"),
    },
    body: JSON.stringify(body),
  });
  const { data, rawText } = await parseResponsePayload({ path, method, res });

  if (!res.ok) {
    throw new Error(buildRequestError({ path, method, res, data, rawText }));
  }

  return data;
}

export async function sendFormData(path, method, formData) {
  const res = await fetch(path, {
    method,
    headers: {
      "x-csrf-token": getCookieValue("csrf_token"),
    },
    body: formData,
  });
  const { data, rawText } = await parseResponsePayload({ path, method, res });

  if (!res.ok) {
    throw new Error(buildRequestError({ path, method, res, data, rawText }));
  }

  return data;
}
