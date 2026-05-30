export function formatMoney(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return period;
  }

  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function formatCashflowNote(note) {
  if (!note) return "-";

  return String(note).replace(/\b(\d{4}-\d{2})(?:-\d{2})?\b/g, (_, period) =>
    formatPeriod(period),
  );
}

export function isImageReceipt(url) {
  const value = String(url || "");

  try {
    const parsed = new URL(value, "https://amarta.local");
    const key = parsed.searchParams.get("key") || parsed.pathname;

    return /\.(jpg|jpeg|png|webp)(?:$|\?)/i.test(decodeURIComponent(key));
  } catch {
    return /\.(jpg|jpeg|png|webp)(?:\?.*)?$/i.test(value);
  }
}
