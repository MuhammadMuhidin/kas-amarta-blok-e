export function buildTrashMismatch({
  personal,
  payments,
  trashRecords,
  monitoringStartPeriod,
  normalize,
}) {
  const issues = [];

  const monitoredPayments = payments.filter(
    (p) => p.period && p.period >= monitoringStartPeriod,
  );

  const trashPaymentIds = new Set(
    trashRecords.map((t) => normalize(t.payment_id)),
  );

  const personalMap = new Map(personal.map((p) => [normalize(p.id), p]));
  const paymentMap = new Map(payments.map((p) => [normalize(p.id), p]));

  monitoredPayments.forEach((pay) => {
    const person = personalMap.get(normalize(pay.person_id));

    if (!person) {
      issues.push({
        type: "MISSING_PERSON",
        house: "-",
        name: "-",
        period: pay.period,
        detail: `Payment references missing person_id: ${pay.person_id}`,
      });

      return;
    }

    const isTrashUser = normalize(person.trash).toUpperCase() === "Y";
    const hasTrash = trashPaymentIds.has(normalize(pay.id));

    if (isTrashUser && !hasTrash) {
      issues.push({
        type: "PAYMENT_WITHOUT_TRASH",
        house: person.house || "-",
        name: person.name || "-",
        period: pay.period,
        detail: "Missing required trash record",
      });
    }

    if (!isTrashUser && hasTrash) {
      issues.push({
        type: "NON_TRASH_HAS_TRASH",
        house: person.house || "-",
        name: person.name || "-",
        period: pay.period,
        detail: "Non-trash user linked to trash record",
      });
    }
  });

  trashRecords.forEach((t) => {
    const tPaymentId = normalize(t.payment_id);
    const payment = paymentMap.get(tPaymentId);

    if (!payment) {
      issues.push({
        type: "ORPHAN_TRASH_RECORD",
        house: "-",
        name: "-",
        period: `Payment ID: ${tPaymentId}`,
        detail: "Trash record references invalid payment",
      });

      return;
    }

    if (payment.period < monitoringStartPeriod) return;

    const person = personalMap.get(normalize(payment.person_id));

    if (!person) {
      issues.push({
        type: "MISSING_PERSON",
        house: "-",
        name: "-",
        period: payment.period,
        detail: `Payment references missing person_id: ${payment.person_id}`,
      });

      return;
    }

    if (normalize(person.trash).toUpperCase() !== "Y") {
      issues.push({
        type: "NON_TRASH_HAS_TRASH",
        house: person.house || "-",
        name: person.name || "-",
        period: payment.period,
        detail: "Non-trash user linked to trash record",
      });
    }
  });

  return Array.from(
    new Map(
      issues.map((i) => [
        [i.type, i.house, i.name, i.period, i.detail].join("|"),
        i,
      ]),
    ).values(),
  ).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}
