export function getCookieValue(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

export const ADMIN_DATA_MUTATED_EVENT = "admin:data-mutated";

const transientStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
const retryableMethods = new Set(["GET", "POST", "PATCH"]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestError({ path, method = "GET", res, data, rawText }) {
  const responseMessage = data?.error || data?.message;
  if (responseMessage) return responseMessage;

  const safeRawText = String(rawText || "").trim();
  if (safeRawText) {
    return `${method} ${path} failed (${res.status} ${res.statusText || "HTTP Error"}): ${safeRawText.slice(0, 180)}`;
  }

  return `${method} ${path} failed without JSON response (${res.status} ${res.statusText || "HTTP Error"})`;
}

function isRetryableHttpStatus(status) {
  return transientStatusCodes.has(Number(status));
}

function isRetryableError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("response is not valid json")
  );
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
      throw new Error(`${method} ${path} succeeded but the response is not valid JSON`);
    }

    return { data: null, rawText };
  }
}

async function requestJson({ path, method = "GET", fetchOptions = {}, retries = 1 }) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const shouldRetry = retries > 0 && retryableMethods.has(normalizedMethod);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(path, fetchOptions);
      const { data, rawText } = await parseResponsePayload({ path, method: normalizedMethod, res });

      if (res.ok) {
        return data;
      }

      const error = new Error(buildRequestError({ path, method: normalizedMethod, res, data, rawText }));
      error.status = res.status;
      error.retryable = isRetryableHttpStatus(res.status);
      lastError = error;

      if (!shouldRetry || !error.retryable || attempt >= retries) {
        throw error;
      }
    } catch (err) {
      lastError = err;

      if (!shouldRetry || !isRetryableError(err) || attempt >= retries) {
        throw err;
      }
    }

    await delay(350 * (attempt + 1));
  }

  throw lastError || new Error(`${normalizedMethod} ${path} failed`);
}

function broadcastMutation({ path, method, body, data }) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(ADMIN_DATA_MUTATED_EVENT, {
    detail: {
      path,
      method,
      body,
      data,
      occurred_at: Date.now(),
    },
  }));
}

export async function readJson(path) {
  return requestJson({
    path,
    method: "GET",
    fetchOptions: { cache: "no-store" },
    retries: 1,
  });
}

export async function sendJson(path, method, body) {
  const normalizedMethod = String(method || "POST").toUpperCase();

  const data = await requestJson({
    path,
    method: normalizedMethod,
    fetchOptions: {
      method: normalizedMethod,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCookieValue("csrf_token"),
      },
      body: JSON.stringify(body),
    },
    retries: 1,
  });

  broadcastMutation({ path, method: normalizedMethod, body, data });
  return data;
}

export async function sendFormData(path, method, formData) {
  const normalizedMethod = String(method || "POST").toUpperCase();

  const data = await requestJson({
    path,
    method: normalizedMethod,
    fetchOptions: {
      method: normalizedMethod,
      headers: {
        "x-csrf-token": getCookieValue("csrf_token"),
      },
      body: formData,
    },
    retries: 1,
  });

  broadcastMutation({ path, method: normalizedMethod, body: null, data });
  return data;
}
