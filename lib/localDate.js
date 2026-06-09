const DEFAULT_TIME_ZONE = "Asia/Jakarta";

export function getLocalDateString(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
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
  return getLocalDateString(date, DEFAULT_TIME_ZONE);
}
