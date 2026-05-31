const DEFAULT_TIME_ZONE = "Asia/Jakarta";

function padMonth(month) {
  return String(month).padStart(2, "0");
}

export function getCurrentPeriod(timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

export function addMonths(period, count) {
  const [year, month] = String(period).split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";

  const totalMonths = year * 12 + (month - 1) + count;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonthIndex = ((totalMonths % 12) + 12) % 12;

  return `${nextYear}-${padMonth(nextMonthIndex + 1)}`;
}

export function getDepositStatus(deposit, currentPeriod, normalize) {
  const isPaid =
    normalize(deposit.status).toLowerCase() === "paid" &&
    normalize(deposit.paid_at) !== "" &&
    normalize(deposit.payment_id) !== "";

  if (isPaid) return "paid";
  if (normalize(deposit.period) > currentPeriod) return "waiting";
  if (normalize(deposit.period) < currentPeriod) return "missed";

  return "pending";
}

export function sortDeposits(deposits, currentPeriod, normalize) {
  const priority = {
    pending: 0,
    waiting: 1,
    missed: 2,
    paid: 3,
  };

  return [...deposits].sort((a, b) => {
    const statusCompare =
      priority[getDepositStatus(a, currentPeriod, normalize)] -
      priority[getDepositStatus(b, currentPeriod, normalize)];

    if (statusCompare !== 0) return statusCompare;

    return String(a.period).localeCompare(String(b.period));
  });
}
