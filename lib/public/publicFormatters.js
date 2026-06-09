import { formatJakartaDate } from "@/lib/localDate";

export function formatMoney(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export function formatDate(value) {
  return formatJakartaDate(value, "id-ID");
}

export function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return period;
  }

  return new Date(`${normalized}-01T00:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
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
