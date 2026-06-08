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
        payment_id: pay.id || "",
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
        payment_id: pay.id || "",
        house: person.house || "-",
        name: person.name || "-",
        period: pay.period,
        detail: "Missing required trash record",
      });
    }

    if (!isTrashUser && hasTrash) {
      issues.push({
        type: "NON_TRASH_HAS_TRASH",
        payment_id: pay.id || "",
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
        payment_id: tPaymentId,
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
        payment_id: payment.id || "",
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
        payment_id: payment.id || "",
        house: person.house || "-",
        name: person.name || "-",
        period: payment.period,
        detail: "Non-trash user linked to trash record",
      });
    }
  });

  return uniqueIssues(issues).sort((a, b) =>
    String(a.period).localeCompare(String(b.period)),
  );
}

export function buildPaymentCashflowIntegrity({
  payments,
  cashflows,
  appConfig,
  monitoringStartPeriod,
  normalize,
}) {
  const issues = [];
  const toNumber = (v) => Number(v || 0);
  const monthlyFee = toNumber(appConfig?.monthly_fee);
  const monitoredPayments = payments.filter(
    (p) => p.period && p.period >= monitoringStartPeriod,
  );
  const paymentById = new Map(payments.map((p) => [normalize(p.id), p]));
  const paymentLinkedCashflow = cashflows.filter((c) => {
    const refId = normalize(c.ref_id);
    const datePeriod = normalize(c.date).slice(0, 7);

    if (normalize(c.type).toLowerCase() !== "income") return false;
    if (!refId) return false;
    if (refId.toUpperCase().startsWith("DIRECT")) return false;
    if (refId.toUpperCase().startsWith("TRASHADV")) return false;
    if (refId.toUpperCase().startsWith("TRASHREIMB")) return false;
    if (!datePeriod) return false;

    return datePeriod >= monitoringStartPeriod;
  });
  const cashflowByRefId = new Map(
    paymentLinkedCashflow.map((c) => [normalize(c.ref_id), c]),
  );
  const duplicateMap = new Map();

  monitoredPayments.forEach((p) => {
    const paymentId = normalize(p.id);
    const amount = toNumber(p.amount);
    const duplicateKey = [
      normalize(p.person_id),
      normalize(p.person_house),
      normalize(p.period),
    ].join("|");

    if (!duplicateMap.has(duplicateKey)) {
      duplicateMap.set(duplicateKey, []);
    }

    duplicateMap.get(duplicateKey).push(p);

    if (monthlyFee && amount !== monthlyFee) {
      issues.push({
        type: "INVALID_PAYMENT_AMOUNT",
        house: p.person_house || "-",
        name: p.person_name || "-",
        period: p.period || "-",
        detail: `Payment amount ${amount} should be ${monthlyFee}`,
      });
    }

    const cashflow = cashflowByRefId.get(paymentId);

    if (!cashflow) {
      issues.push({
        type: "MISSING_CASHFLOW",
        house: p.person_house || "-",
        name: p.person_name || "-",
        period: p.period || "-",
        detail: `Payment ${paymentId} has no linked cashflow income`,
      });

      return;
    }

    if (toNumber(cashflow.amount) !== amount) {
      issues.push({
        type: "AMOUNT_MISMATCH",
        house: p.person_house || "-",
        name: p.person_name || "-",
        period: p.period || "-",
        detail: `Payment ${amount} but cashflow ${cashflow.amount}`,
      });
    }
  });

  paymentLinkedCashflow.forEach((c) => {
    const refId = normalize(c.ref_id);
    const payment = paymentById.get(refId);

    if (!payment) {
      issues.push({
        type: "ORPHAN_CASHFLOW",
        house: "-",
        name: "-",
        period: c.date || "-",
        detail: `Cashflow references invalid payment_id: ${refId}`,
      });
    }
  });

  duplicateMap.forEach((items) => {
    if (items.length > 1) {
      const first = items[0];

      issues.push({
        type: "DUPLICATE_PAYMENT",
        house: first.person_house || "-",
        name: first.person_name || "-",
        period: first.period || "-",
        detail: `${items.length} payments found for same house and period`,
      });
    }
  });

  return issues.sort((a, b) =>
    String(a.period).localeCompare(String(b.period)),
  );
}

function parseTrashAdvanceRefId(refId, normalize) {
  const normalized = normalize(refId);
  const parts = normalized.split("-");

  if (parts.length < 4 || parts[0].toUpperCase() !== "TRASHADV") return null;

  const period = `${parts.at(-2)}-${parts.at(-1)}`;
  if (!/^\d{4}-\d{2}$/.test(period)) return null;

  const personId = parts.slice(1, -2).join("-");
  if (!personId) return null;

  return { personId, period };
}

function parseTrashReimbursementRefId(refId, normalize) {
  const normalized = normalize(refId);
  const prefix = "TRASHREIMB-";

  if (!normalized.toUpperCase().startsWith(prefix)) return null;

  const paymentId = normalized.slice(prefix.length);
  if (!paymentId) return null;

  return { paymentId };
}

function buildTrashAdvanceRefId(personId, period, normalize) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildTrashReimbursementRefId(paymentId, normalize) {
  return `TRASHREIMB-${normalize(paymentId)}`;
}

function pushTrashAdvanceIssue(issues, type, payment, period, detail, extra = {}) {
  issues.push({
    type,
    payment_id: payment?.id || "",
    house: payment?.person_house || extra.house || "-",
    name: payment?.person_name || extra.name || "-",
    period: period || payment?.period || "-",
    detail,
  });
}

export function buildTrashAdvanceReimbursementIntegrity({
  personal,
  payments,
  trashRecords,
  cashflows,
  monitoringStartPeriod,
  normalize,
}) {
  const issues = [];
  const toNumber = (v) => Number(v || 0);
  const personalById = new Map(personal.map((person) => [normalize(person.id), person]));
  const paymentById = new Map(payments.map((payment) => [normalize(payment.id), payment]));
  const paidTrashByKey = new Map();

  trashRecords.forEach((trash) => {
    const payment = paymentById.get(normalize(trash.payment_id));
    if (!payment) return;

    const period = normalize(payment.period);
    if (!period || period < monitoringStartPeriod) return;

    paidTrashByKey.set(`${normalize(payment.person_id)}|${period}`, {
      payment,
      trash,
    });
  });

  const advanceByKey = new Map();
  const reimbursementByRefId = new Map();
  const reimbursementCashflows = [];

  cashflows.forEach((cashflow) => {
    const refId = normalize(cashflow.ref_id);
    const type = normalize(cashflow.type).toLowerCase();
    const advance = parseTrashAdvanceRefId(refId, normalize);
    const reimbursement = parseTrashReimbursementRefId(refId, normalize);

    if (advance && type === "expense") {
      if (advance.period >= monitoringStartPeriod) {
        const key = `${normalize(advance.personId)}|${advance.period}`;
        if (!advanceByKey.has(key)) advanceByKey.set(key, []);
        advanceByKey.get(key).push(cashflow);
      }
      return;
    }

    if (reimbursement) {
      reimbursementCashflows.push(cashflow);
      if (!reimbursementByRefId.has(refId)) reimbursementByRefId.set(refId, []);
      reimbursementByRefId.get(refId).push(cashflow);
    }
  });

  advanceByKey.forEach((advanceItems, key) => {
    const [personId, period] = key.split("|");
    const paidTrash = paidTrashByKey.get(key);
    const person = personalById.get(personId);
    const payment = paidTrash?.payment;
    const house = payment?.person_house || person?.house || "-";
    const name = payment?.person_name || person?.name || "-";

    if (advanceItems.length > 1) {
      pushTrashAdvanceIssue(
        issues,
        "DUPLICATE_ADVANCE",
        payment,
        period,
        `${advanceItems.length} trash advance cashflows found for same member and period`,
        { house, name },
      );
    }

    if (!payment) return;

    const advanceAmount = advanceItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const reimbursementRefId = buildTrashReimbursementRefId(payment.id, normalize);
    const reimbursementItems = reimbursementByRefId.get(reimbursementRefId) || [];

    if (!reimbursementItems.length) {
      pushTrashAdvanceIssue(
        issues,
        "MISSING_REIMBURSEMENT",
        payment,
        period,
        `Trash advance ${buildTrashAdvanceRefId(personId, period, normalize)} has paid trash record but no reimbursement cashflow ${reimbursementRefId}`,
        { house, name },
      );
      return;
    }

    if (reimbursementItems.length > 1) {
      pushTrashAdvanceIssue(
        issues,
        "DUPLICATE_REIMBURSEMENT",
        payment,
        period,
        `${reimbursementItems.length} reimbursement cashflows found for ${reimbursementRefId}`,
        { house, name },
      );
    }

    const invalidType = reimbursementItems.find((item) => normalize(item.type).toLowerCase() !== "income");
    if (invalidType) {
      pushTrashAdvanceIssue(
        issues,
        "INVALID_REIMBURSEMENT_TYPE",
        payment,
        period,
        `Reimbursement ${reimbursementRefId} must be income, found ${invalidType.type || "-"}`,
        { house, name },
      );
    }

    const reimbursementAmount = reimbursementItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
    if (advanceAmount !== reimbursementAmount) {
      pushTrashAdvanceIssue(
        issues,
        "REIMBURSEMENT_AMOUNT_MISMATCH",
        payment,
        period,
        `Trash advance ${advanceAmount} but reimbursement ${reimbursementAmount}`,
        { house, name },
      );
    }
  });

  reimbursementCashflows.forEach((cashflow) => {
    const refId = normalize(cashflow.ref_id);
    const parsed = parseTrashReimbursementRefId(refId, normalize);
    const payment = paymentById.get(normalize(parsed?.paymentId));
    const datePeriod = normalize(cashflow.date).slice(0, 7);

    if (!payment) {
      if (datePeriod && datePeriod < monitoringStartPeriod) return;
      pushTrashAdvanceIssue(
        issues,
        "ORPHAN_REIMBURSEMENT",
        null,
        datePeriod || "-",
        `Reimbursement ${refId} references invalid payment`,
      );
      return;
    }

    const period = normalize(payment.period);
    if (period && period < monitoringStartPeriod) return;

    const advanceKey = `${normalize(payment.person_id)}|${period}`;
    if (!advanceByKey.has(advanceKey)) {
      pushTrashAdvanceIssue(
        issues,
        "ORPHAN_REIMBURSEMENT",
        payment,
        period,
        `Reimbursement ${refId} has no matching trash advance ${buildTrashAdvanceRefId(payment.person_id, period, normalize)}`,
      );
    }
  });

  return uniqueIssues(issues).sort((a, b) =>
    String(a.period).localeCompare(String(b.period)),
  );
}

export function buildDepositPaymentIntegrity({
  deposits,
  personal,
  payments,
  monitoringStartPeriod,
  normalize,
}) {
  const issues = [];
  const personalMap = new Map(personal.map((p) => [normalize(p.id), p]));
  const paymentMap = new Map(payments.map((p) => [normalize(p.id), p]));
  const activeDepositMap = new Map();
  const monitoredDeposits = deposits.filter((deposit) => {
    const period = normalize(deposit.period);
    return period && period >= monitoringStartPeriod;
  });

  monitoredDeposits.forEach((deposit) => {
    const status = normalize(deposit.status).toLowerCase();
    const isPaid = status === "paid";
    const isCancelled = status === "cancelled";
    const paymentId = normalize(deposit.payment_id);
    const paidAt = normalize(deposit.paid_at);
    const person = personalMap.get(normalize(deposit.person_id));
    const house = deposit.house || person?.house || "-";
    const name = deposit.name || person?.name || "-";
    const period = deposit.period || "-";

    if (!person) {
      issues.push({
        type: "DEPOSIT_MISSING_PERSON",
        house,
        name,
        period,
        detail: `Deposit references missing person_id: ${deposit.person_id}`,
      });
    } else {
      if (normalize(deposit.house) !== normalize(person.house)) {
        issues.push({
          type: "DEPOSIT_PERSON_HOUSE_MISMATCH",
          house,
          name,
          period,
          detail: `Deposit house ${deposit.house || "-"} differs from member house ${person.house || "-"}`,
        });
      }

      if (normalize(deposit.name) !== normalize(person.name)) {
        issues.push({
          type: "DEPOSIT_PERSON_NAME_MISMATCH",
          house,
          name,
          period,
          detail: `Deposit name ${deposit.name || "-"} differs from member name ${person.name || "-"}`,
        });
      }
    }

    if (!isCancelled) {
      const duplicateKey = [normalize(deposit.person_id), normalize(deposit.house), normalize(deposit.period)].join("|");

      if (!activeDepositMap.has(duplicateKey)) {
        activeDepositMap.set(duplicateKey, []);
      }

      activeDepositMap.get(duplicateKey).push(deposit);
    }

    if (isPaid && !paidAt) {
      issues.push({
        type: "PAID_DEPOSIT_MISSING_PAID_AT",
        house,
        name,
        period,
        detail: `Paid deposit ${deposit.id || "-"} has no paid_at`,
      });
    }

    if (isPaid && !paymentId) {
      issues.push({
        type: "PAID_DEPOSIT_MISSING_PAYMENT_ID",
        house,
        name,
        period,
        detail: `Paid deposit ${deposit.id || "-"} has no payment_id`,
      });
    }

    if (!isPaid && paymentId) {
      issues.push({
        type: "UNPAID_DEPOSIT_HAS_PAYMENT_ID",
        house,
        name,
        period,
        detail: `Unpaid deposit ${deposit.id || "-"} has payment_id ${paymentId}`,
      });
    }

    if (!isPaid && paidAt) {
      issues.push({
        type: "UNPAID_DEPOSIT_HAS_PAID_AT",
        house,
        name,
        period,
        detail: `Unpaid deposit ${deposit.id || "-"} has paid_at ${paidAt}`,
      });
    }

    if (!isPaid || !paymentId) return;

    const payment = paymentMap.get(paymentId);

    if (!payment) {
      issues.push({
        type: "DEPOSIT_PAYMENT_NOT_FOUND",
        house,
        name,
        period,
        detail: `Deposit payment_id ${paymentId} was not found in Payment`,
      });

      return;
    }

    if (normalize(payment.period) !== normalize(deposit.period)) {
      issues.push({
        type: "DEPOSIT_PAYMENT_PERIOD_MISMATCH",
        house,
        name,
        period,
        detail: `Deposit period ${deposit.period || "-"} differs from payment period ${payment.period || "-"}`,
      });
    }

    if (normalize(payment.person_id) !== normalize(deposit.person_id) && normalize(payment.person_house) !== normalize(deposit.house)) {
      issues.push({
        type: "DEPOSIT_PAYMENT_PERSON_MISMATCH",
        house,
        name,
        period,
        detail: `Deposit person/house differs from linked payment ${paymentId}`,
      });
    }

    if (Number(payment.amount || 0) !== Number(deposit.amount || 0)) {
      issues.push({
        type: "DEPOSIT_PAYMENT_AMOUNT_MISMATCH",
        house,
        name,
        period,
        detail: `Deposit amount ${deposit.amount || 0} but payment amount ${payment.amount || 0}`,
      });
    }
  });

  activeDepositMap.forEach((items) => {
    if (items.length > 1) {
      const first = items[0];

      issues.push({
        type: "DUPLICATE_ACTIVE_DEPOSIT",
        house: first.house || "-",
        name: first.name || "-",
        period: first.period || "-",
        detail: `${items.length} active deposits found for same house and period`,
      });
    }
  });

  return issues.sort((a, b) =>
    String(a.period).localeCompare(String(b.period)),
  );
}

export function buildSuspiciousData({
  personal,
  payments,
  cashflows,
  trashRecords,
  deposits = [],
  normalize,
}) {
  const issues = [];

  checkDuplicateId(issues, "Personal", personal, normalize);
  checkDuplicateId(issues, "Payment", payments, normalize);
  checkDuplicateId(issues, "Cashflow", cashflows, normalize);
  checkDuplicateId(issues, "Trash", trashRecords, normalize);
  checkDuplicateId(issues, "Deposit", deposits, normalize);

  checkEmptyFields(issues, "Personal", personal, [
    "id",
    "house",
    "name",
    "trash",
    "active",
    "join_date",
  ], normalize);

  checkEmptyFields(issues, "Payment", payments, [
    "id",
    "person_id",
    "person_house",
    "person_name",
    "period",
    "amount",
    "date",
  ], normalize);

  checkEmptyFields(issues, "Cashflow", cashflows, [
    "id",
    "ref_id",
    "type",
    "amount",
    "note",
    "date",
  ], normalize);

  checkEmptyFields(issues, "Deposit", deposits, [
    "id",
    "person_id",
    "house",
    "name",
    "period",
    "amount",
    "status",
    "created_at",
  ], normalize);

  return issues;
}

function uniqueIssues(issues) {
  return Array.from(
    new Map(
      issues.map((i) => [
        [i.type, i.house, i.name, i.period, i.detail].join("|"),
        i,
      ]),
    ).values(),
  );
}

function checkDuplicateId(issues, sheetName, rows, normalize) {
  const map = new Map();

  rows.forEach((row, index) => {
    const id = normalize(row.id);
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(index + 2);
  });

  map.forEach((rowNumbers, id) => {
    if (rowNumbers.length > 1) {
      issues.push({
        sheet: sheetName,
        type: "DUPLICATE_ID",
        row: rowNumbers.join(", "),
        detail: `Duplicate ID: ${id}`,
      });
    }
  });
}

function checkEmptyFields(issues, sheetName, rows, fields, normalize) {
  rows.forEach((row, index) => {
    const emptyFields = fields.filter(
      (field) => normalize(row[field]) === "",
    );

    if (emptyFields.length > 0) {
      issues.push({
        sheet: sheetName,
        type: "EMPTY_FIELD",
        row: index + 2,
        detail: `Empty field: ${emptyFields.join(", ")}`,
      });
    }
  });
}
