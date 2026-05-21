export function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function addMonths(period, count) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + count, 1);

  return date.toISOString().slice(0, 7);
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
