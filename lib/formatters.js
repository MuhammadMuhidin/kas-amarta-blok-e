export function formatCurrency(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

export function formatPeriod(period) {
  if (!period) return "-";

  const [year, month] = String(period).split("-");

  return `${month}/${year}`;
}

export function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
