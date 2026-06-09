import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { getCurrentPeriod, sortDeposits } from "@/lib/depositUtils";
import {
  findDepositById,
  findMemberById,
  findTrashAdvanceCashflow,
  hasCashflowByPaymentId,
  hasTrashByPaymentId,
  insertCashflow,
  insertDeposits,
  insertPayment,
  insertTrash,
  listDeposits,
  listExistingDepositsForPeriods,
  listPaymentsByPeriod,
  updateDeposit,
} from "@/features/deposit/depositRepository";

function normalize(value) {
  return String(value || "").trim();
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPeriodLabel(period) {
  const normalized = normalize(period);
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);

  if (!match) return normalized;

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const monthIndex = Number(match[2]) - 1;

  if (monthIndex < 0 || monthIndex >= monthNames.length) return normalized;

  return `${monthNames[monthIndex]} ${match[1]}`;
}

function buildTrashAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function buildTrashReimbursementRefId(paymentId) {
  return `TRASHREIMB-${normalize(paymentId)}`;
}

function buildTrashReimbursementNote(house, period) {
  return `Pengembalian Talangan Iuran Sampah ${house} Periode ${formatPeriodLabel(period)}`;
}

function findExistingPayment(paymentRows, { person_id, person_house }) {
  return (paymentRows || []).find((item) => {
    const samePerson = normalize(item.person_id) === normalize(person_id);
    const sameHouse = normalize(item.person_house) === normalize(person_house);
    return samePerson || sameHouse;
  }) || null;
}

function validateBookingAmount({ amount, trashAmount, currentMonthlyFee, currentTrashFee, isTrashUser }) {
  if (amount !== currentMonthlyFee) {
    return `Kas booking Rp${amount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentMonthlyFee.toLocaleString("id-ID")}`;
  }

  if (!isTrashUser && trashAmount > 0) {
    return "Warga ini tidak terdaftar iuran sampah, trash booking harus Rp0";
  }

  if (isTrashUser && trashAmount !== currentTrashFee) {
    return `Trash booking Rp${trashAmount.toLocaleString("id-ID")} berbeda dengan tarif aktif Rp${currentTrashFee.toLocaleString("id-ID")}`;
  }

  return "";
}

export async function listDepositRecords({ supabase, searchParams }) {
  const data = await listDeposits(supabase);
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return data;
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const from = (page - 1) * limit;
  const to = from + limit;
  const sorted = sortDeposits(data, getCurrentPeriod(), normalize);

  return {
    ok: true,
    deposits: sorted.slice(from, to),
    pagination: {
      page,
      limit,
      total: sorted.length,
      total_pages: Math.max(Math.ceil(sorted.length / limit), 1),
    },
  };
}

export async function ensurePaymentCashflow({ supabase, paymentId, personHouse, period, amount, date }) {
  const hasCashflow = await hasCashflowByPaymentId(supabase, paymentId);

  if (hasCashflow) return false;

  const note = `Pembayaran Kas ${personHouse} Periode ${period}`;
  await insertCashflow(supabase, {
    id: generateId("CSFLOW-"),
    payment_id: paymentId,
    type: "income",
    amount,
    note,
    date,
    receipt_url: "",
  });

  return true;
}

export async function ensureTrashPayment({ supabase, paymentId, trashAmount, date }) {
  if (trashAmount <= 0) return false;

  const hasTrash = await hasTrashByPaymentId(supabase, paymentId);

  if (hasTrash) return false;

  await insertTrash(supabase, {
    id: generateId("TRASH-"),
    payment_id: paymentId,
    amount: trashAmount,
    date,
  });

  return true;
}

export async function ensureTrashAdvanceReimbursement({ supabase, paymentId, personId, personHouse, period, date }) {
  const advancePaymentId = buildTrashAdvanceRefId(personId, period);
  const reimbursementPaymentId = buildTrashReimbursementRefId(paymentId);

  const advanceRow = await findTrashAdvanceCashflow(supabase, advancePaymentId);

  if (!advanceRow) return false;

  const hasReimbursement = await hasCashflowByPaymentId(supabase, reimbursementPaymentId);

  if (hasReimbursement) return false;

  const reimbursementAmount = Number(advanceRow.amount || 0);

  if (!Number.isFinite(reimbursementAmount) || reimbursementAmount <= 0) return false;

  await insertCashflow(supabase, {
    id: generateId("CSFLOW-"),
    payment_id: reimbursementPaymentId,
    type: "income",
    amount: reimbursementAmount,
    note: buildTrashReimbursementNote(personHouse, period),
    date,
    receipt_url: "",
  });

  return true;
}

export async function createDepositBookings({ supabase, req, body }) {
  const { person_id, house, name, periods, amount } = body;

  if (!person_id || !house || !name || !Array.isArray(periods)) {
    return { status: 400, body: { error: "Invalid payload" } };
  }

  const member = await findMemberById(supabase, person_id);

  if (!member) {
    return { status: 404, body: { error: "Member not found" } };
  }

  const appConfig = await getAppConfig();
  const isTrashUser = String(member.trash || "").toUpperCase() === "Y";
  const trashAmount = isTrashUser ? Number(appConfig?.trash_fee) || 0 : 0;
  const existing = await listExistingDepositsForPeriods(supabase, person_id, periods);
  const now = new Date().toISOString();
  const values = periods
    .filter((period) => {
      return !existing.some(
        (r) => r.person_id === person_id && r.period === period && r.status !== "cancelled",
      );
    })
    .map((period) => ({
      id: generateId("DEP-"),
      person_id,
      house,
      name,
      period,
      amount,
      trash_amount: trashAmount,
      status: "pending",
      created_at: now,
      paid_at: null,
      payment_id: null,
    }));

  await insertDeposits(supabase, values);

  await recordAdminActivity(req, {
    type: "create",
    module: "deposit",
    severity: "success",
    message: `Save deposit ${house} ${values.length} period`,
    metadata: {
      person_id,
      house,
      name,
      periods,
      amount,
      trash_amount: trashAmount,
      inserted: values.length,
      deposit_ids: values.map((item) => item.id),
    },
  });

  return { status: 200, body: { success: true, inserted: values.length } };
}

export async function processDepositAction({ supabase, req, body, today }) {
  const { id, action } = body;
  const deposit = await findDepositById(supabase, id);

  if (!deposit) {
    return { status: 404, body: { error: "Deposit not found" } };
  }

  const appConfig = await getAppConfig();
  const currentMonthlyFee = Number(appConfig?.monthly_fee) || 0;
  const currentTrashFee = Number(appConfig?.trash_fee) || 0;
  const member = await findMemberById(supabase, deposit.person_id);

  if (!member) {
    return { status: 404, body: { error: "Member not found" } };
  }

  const isTrashUser = normalize(member.trash).toUpperCase() === "Y";

  if (action === "UPDATE_SNAPSHOT") {
    if (!["pending", "waiting"].includes(String(deposit.status || ""))) {
      return { status: 400, body: { error: "Only active booking can be edited" } };
    }

    const amount = Number(body.amount);
    const trashAmount = Number(body.trash_amount || 0);

    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(trashAmount) || trashAmount < 0) {
      return { status: 400, body: { error: "Invalid booking amount" } };
    }

    const validationError = validateBookingAmount({
      amount,
      trashAmount,
      currentMonthlyFee,
      currentTrashFee,
      isTrashUser,
    });

    if (validationError) {
      return { status: 400, body: { error: validationError } };
    }

    await updateDeposit(supabase, id, { amount, trash_amount: trashAmount, updated_at: new Date().toISOString() });

    await recordAdminActivity(req, {
      type: "update",
      module: "deposit",
      severity: "success",
      message: `Update booking snapshot ${deposit.house} ${deposit.period}`,
      metadata: {
        deposit_id: id,
        house: deposit.house,
        period: deposit.period,
        before: {
          amount: Number(deposit.amount) || 0,
          trash_amount: Number(deposit.trash_amount) || 0,
        },
        after: { amount, trash_amount: trashAmount },
      },
    });

    return { status: 200, body: { success: true } };
  }

  const person_id = deposit.person_id;
  const person_house = deposit.house;
  const person_name = deposit.name;
  const period = deposit.period;
  const amount = Number(deposit.amount) || 0;
  const trashAmount = Number(deposit.trash_amount) || 0;
  const validationError = validateBookingAmount({
    amount,
    trashAmount,
    currentMonthlyFee,
    currentTrashFee,
    isTrashUser,
  });

  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  const paymentRows = await listPaymentsByPeriod(supabase, period);
  const existingPayment = findExistingPayment(paymentRows, { person_id, person_house });

  if (normalize(deposit.status).toLowerCase() === "paid" && normalize(deposit.payment_id)) {
    const paymentDate = deposit.paid_at || today;
    await ensurePaymentCashflow({
      supabase,
      paymentId: deposit.payment_id,
      personHouse: person_house,
      period,
      amount,
      date: paymentDate,
    });
    await ensureTrashPayment({ supabase, paymentId: deposit.payment_id, trashAmount, date: paymentDate });
    const trashReimbursementRecovered = await ensureTrashAdvanceReimbursement({
      supabase,
      paymentId: deposit.payment_id,
      personId: person_id,
      personHouse: person_house,
      period,
      date: paymentDate,
    });

    return {
      status: 200,
      body: {
        success: true,
        existing: true,
        payment_id: deposit.payment_id,
        trash_reimbursement_recovered: trashReimbursementRecovered,
      },
    };
  }

  if (existingPayment) {
    const existingPaymentId = existingPayment.id;
    const existingPaymentDate = existingPayment.date || today;
    const existingPaymentAmount = Number(existingPayment.amount) || amount;
    const cashflowRecovered = await ensurePaymentCashflow({
      supabase,
      paymentId: existingPaymentId,
      personHouse: existingPayment.person_house || person_house,
      period,
      amount: existingPaymentAmount,
      date: existingPaymentDate,
    });
    const trashRecovered = await ensureTrashPayment({
      supabase,
      paymentId: existingPaymentId,
      trashAmount,
      date: existingPaymentDate,
    });
    const trashReimbursementRecovered = await ensureTrashAdvanceReimbursement({
      supabase,
      paymentId: existingPaymentId,
      personId: existingPayment.person_id || person_id,
      personHouse: existingPayment.person_house || person_house,
      period,
      date: existingPaymentDate,
    });

    await updateDeposit(supabase, id, {
      status: "paid",
      paid_at: existingPaymentDate,
      payment_id: existingPaymentId,
      updated_at: new Date().toISOString(),
    });

    await recordAdminActivity(req, {
      type: "idempotent",
      module: "deposit",
      severity: "info",
      message: `Reuse existing payment for deposit ${person_house} ${period}`,
      metadata: {
        deposit_id: id,
        payment_id: existingPaymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount: existingPaymentAmount,
        trash_amount: trashAmount,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
        trash_reimbursement_recovered: trashReimbursementRecovered,
      },
    });

    return {
      status: 200,
      body: {
        success: true,
        existing: true,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
        trash_reimbursement_recovered: trashReimbursementRecovered,
        payment_id: existingPaymentId,
      },
    };
  }

  const paymentId = generateId("PAY-");

  await insertPayment(supabase, {
    id: paymentId,
    person_id,
    person_house,
    person_name,
    period,
    amount,
    date: today,
  });

  const cashflowRecorded = await ensurePaymentCashflow({ supabase, paymentId, personHouse: person_house, period, amount, date: today });
  const trashRecorded = await ensureTrashPayment({ supabase, paymentId, trashAmount, date: today });
  const trashReimbursementRecorded = await ensureTrashAdvanceReimbursement({
    supabase,
    paymentId,
    personId: person_id,
    personHouse: person_house,
    period,
    date: today,
  });

  await updateDeposit(supabase, id, {
    status: "paid",
    paid_at: today,
    payment_id: paymentId,
    updated_at: new Date().toISOString(),
  });

  await recordAdminActivity(req, {
    type: "pay",
    module: "deposit",
    severity: "success",
    message: `Pay deposit ${person_house} ${period}`,
    metadata: {
      deposit_id: id,
      payment_id: paymentId,
      person_id,
      house: person_house,
      name: person_name,
      period,
      amount,
      trash_amount: trashAmount,
      paid_at: today,
      cashflow_recorded: cashflowRecorded,
      trash_recorded: trashRecorded,
      trash_reimbursement_recorded: trashReimbursementRecorded,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      payment_id: paymentId,
      cashflow_recorded: cashflowRecorded,
      trash_recorded: trashRecorded,
      trash_reimbursement_recorded: trashReimbursementRecorded,
    },
  };
}
