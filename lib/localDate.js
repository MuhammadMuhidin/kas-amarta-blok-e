export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseDisplayDate(value) {
  const normalized = String(value || "").trim();

  if (!normalized) return null;
  if (isDateOnly(normalized)) {
    return new Date(`${normalized}T00:00:00+07:00`);
  }

  return new Date(normalized);
}

export function getLocalDateString(date = new Date(), timeZone = JAKARTA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function getJakartaDateString(date = new Date()) {
  return getLocalDateString(date, JAKARTA_TIME_ZONE);
}

export function formatJakartaDate(value, locale = "id-ID") {
  if (!value) return "-";

  const date = parseDisplayDate(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(locale, {
    timeZone: JAKARTA_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatJakartaDateTime(value, locale = "id-ID") {
  if (!value) return "-";

  const date = parseDisplayDate(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(locale, {
    timeZone: JAKARTA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatJakartaDateTimeLong(value, locale = "id-ID") {
  if (!value) return "-";

  const date = parseDisplayDate(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(locale, {
    timeZone: JAKARTA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}
