export function getResidentPaymentStatus(resident) {
  if (!resident) {
    return { value: "unknown", label: "-", color: "#6c757d" };
  }

  if (resident.notApplicable) {
    return { value: "not_applicable", label: "Belum menjadi anggota", color: "#6c757d" };
  }

  if (resident.paid) {
    return { value: "paid", label: "Sudah bayar", color: "#28a745" };
  }

  const confirmationStatus = String(resident.paymentConfirmation?.status || "").toLowerCase();

  if (confirmationStatus === "pending") {
    return { value: "processing", label: "Sedang diproses", color: "#f59e0b" };
  }

  return { value: "unpaid", label: "Belum bayar", color: "#dc3545" };
}

export function buildPaymentList({ persons = [], payments = [], paymentConfirmations = [], selectedPeriod }) {
  if (!selectedPeriod || !persons.length) return [];

  const period = selectedPeriod.slice(0, 7);

  return persons
    .map((person) => {
      let paid = false;
      let notApplicable = false;
      let paymentConfirmation = null;

      if (person.join_date && period < person.join_date.slice(0, 7)) {
        notApplicable = true;
      } else {
        paid = payments.some(
          (payment) => payment.person_id === person.id && payment.period.slice(0, 7) === period,
        );
        paymentConfirmation = paymentConfirmations.find(
          (confirmation) =>
            confirmation.person_id === person.id &&
            String(confirmation.period || "").slice(0, 7) === period,
        ) || null;
      }

      const resident = {
        id: person.id,
        house: person.house,
        join_date: person.join_date,
        trash: person.trash,
        paid,
        notApplicable,
        paymentConfirmation,
      };

      return {
        ...resident,
        paymentStatus: getResidentPaymentStatus(resident),
      };
    })
    .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
}

export function filterCashflows(cashflows = [], searchTerm = "") {
  const query = searchTerm.toLowerCase();
  return cashflows.filter((cashflow) => (cashflow.note || "").toLowerCase().includes(query));
}

export function calculateCashflowTotals(cashflows = []) {
  return cashflows.reduce(
    (total, cashflow) => {
      if (cashflow.type === "income") {
        total.inc += Number(cashflow.amount || 0);
      } else {
        total.exp += Number(cashflow.amount || 0);
      }

      total.net = total.inc - total.exp;
      return total;
    },
    { inc: 0, exp: 0, net: 0 },
  );
}

export function calculateExpenseDelta(insight = {}) {
  const current = insight?.currentMonth?.expenseTotal || 0;
  const last = insight?.lastMonth?.expenseTotal || 0;

  if (!last) return 0;

  return ((current - last) / last) * 100;
}

export function calculateExpenseDeltaAmount(insight = {}) {
  const current = insight?.currentMonth?.expenseTotal || 0;
  const last = insight?.lastMonth?.expenseTotal || 0;
  return Math.abs(current - last);
}

export function calculateBalanceDelta(insight = {}) {
  const current = insight?.summary?.currentBalance || 0;
  const last = insight?.lastMonth?.remaining || 0;

  if (!last) return 0;

  return ((current - last) / last) * 100;
}

export function calculateBalanceDeltaAmount(insight = {}) {
  const current = insight?.summary?.currentBalance || 0;
  const last = insight?.lastMonth?.remaining || 0;
  return Math.abs(current - last);
}

export function countActiveMembers({ persons = [], periods = [] }) {
  if (!periods.length) return 0;

  const lastPeriod = [...periods].sort().pop();

  return persons.filter((person) => {
    if (!person.join_date) return true;
    return person.join_date.slice(0, 7) <= lastPeriod;
  }).length;
}

export function countPaidInLastPeriod({ payments = [], periods = [] }) {
  if (!periods.length) return 0;

  const last = [...periods].sort((a, b) => a.localeCompare(b)).pop();

  return new Set(
    payments
      .filter((payment) => (payment.period || "").slice(0, 7) === last)
      .map((payment) => `${payment.person_id}-${payment.person_house}`),
  ).size;
}

export function buildInsightResult({ persons = [], payments = [], periods = [] }) {
  if (!periods.length) return [];

  return persons
    .map((person) => {
      const validPeriods = periods.filter((period) => {
        if (!person.join_date) return true;
        return period >= person.join_date.slice(0, 7);
      });

      const paid = payments
        .filter((payment) => payment.person_id === person.id && payment.person_house === person.house)
        .map((payment) => payment.period.slice(0, 7));

      const unpaid = validPeriods.filter((period) => !paid.includes(period));

      return {
        house: person.house,
        name: person.name,
        unpaid,
        jumlah: unpaid.length,
      };
    })
    .filter((result) => result.jumlah >= 1)
    .sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
}

export function getLastPaymentPeriod({ resident, payments = [] }) {
  if (!resident) return "-";

  const paid = payments
    .filter(
      (payment) =>
        payment.person_id === resident.id && payment.person_house === resident.house,
    )
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));

  return paid[0]?.period || "Belum ada pembayaran";
}

export function getSelectedPeriodStatus(resident) {
  return getResidentPaymentStatus(resident).label;
}

export function getPaymentConfirmationStatus(resident) {
  const status = String(resident?.paymentConfirmation?.status || "").toLowerCase();

  if (resident?.paid) return "Disetujui admin";
  if (status === "pending") return "Menunggu persetujuan admin";
  if (status === "approved") return "Disetujui admin";
  if (status === "rejected") return "Ditolak admin";

  return "Belum ada konfirmasi";
}

export function canUploadPaymentProof(resident) {
  if (!resident || resident.paid || resident.notApplicable) return false;

  const status = String(resident.paymentConfirmation?.status || "").toLowerCase();
  return !status || status === "rejected";
}

export function getRegisteredServices(resident) {
  if (!resident) return "-";

  const services = ["Kas"];

  if ((resident.trash || "").toUpperCase() === "Y") {
    services.push("Sampah");
  }

  return services.join(" dan ");
}
