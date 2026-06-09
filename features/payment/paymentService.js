import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  findMemberByHouse,
  findTrashAdvanceCashflow,
  hasCashflowByPaymentId,
  hasTrashByPaymentId,
  insertCashflow,
  insertPayment,
  insertTrash,
  listPayments,
  listPaymentsByPeriod,
} from "@/features/payment/paymentRepository";

function normalize(value) {
  return String(value || "").trim();
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

export async function listPaymentRecords(supabase) {
  return listPayments(supabase);
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

export async function ensurePaymentTrash({ supabase, paymentId, member, date }) {
  const isTrashUser = normalize(member?.trash).toUpperCase() === "Y";

  if (!isTrashUser) return false;

  const appConfig = await getAppConfig();
  const trashAmount = Number(appConfig?.trash_fee || 0);

  if (!trashAmount) {
    throw new Error("Tarif sampah belum dikonfigurasi.");
  }

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

export async function recordPayment({ supabase, req, house, period, amount, bulkBatchId, today }) {
  const member = await findMemberByHouse(supabase, house);

  if (!member) {
    return {
      status: 404,
      body: { error: "House not found" },
    };
  }

  const person_id = member.id;
  const person_house = member.house;
  const person_name = member.name;
  const paymentRows = await listPaymentsByPeriod(supabase, period);

  const existingPayment = (paymentRows || []).find((item) => {
    const samePerson = normalize(item.person_id) === normalize(person_id);
    const sameHouse = normalize(item.person_house) === normalize(person_house);
    return samePerson || sameHouse;
  });

  if (existingPayment) {
    const existingPaymentId = existingPayment.id;
    const existingPaymentAmount = Number(existingPayment.amount) || amount;
    const existingPaymentDate = existingPayment.date || today;
    const cashflowRecovered = await ensurePaymentCashflow({
      supabase,
      paymentId: existingPaymentId,
      personHouse: existingPayment.person_house || person_house,
      period,
      amount: existingPaymentAmount,
      date: existingPaymentDate,
    });
    const trashRecovered = await ensurePaymentTrash({
      supabase,
      paymentId: existingPaymentId,
      member,
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

    await recordAdminActivity(req, {
      type: "idempotent",
      module: "payment",
      severity: "info",
      message: `Reuse existing payment ${person_house} ${period}`,
      metadata: {
        payment_id: existingPaymentId,
        person_id,
        house: person_house,
        name: person_name,
        period,
        amount: existingPaymentAmount,
        cashflow_recovered: cashflowRecovered,
        trash_recovered: trashRecovered,
        trash_reimbursement_recovered: trashReimbursementRecovered,
        bulk_batch_id: bulkBatchId || null,
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

  const cashflowRecorded = await ensurePaymentCashflow({
    supabase,
    paymentId,
    personHouse: person_house,
    period,
    amount,
    date: today,
  });
  const trashRecorded = await ensurePaymentTrash({ supabase, paymentId, member, date: today });
  const trashReimbursementRecorded = await ensureTrashAdvanceReimbursement({
    supabase,
    paymentId,
    personId: person_id,
    personHouse: person_house,
    period,
    date: today,
  });

  await recordAdminActivity(req, {
    type: "create",
    module: "payment",
    severity: "success",
    message: `Record payment ${person_house} ${period}`,
    metadata: {
      payment_id: paymentId,
      person_id,
      house: person_house,
      name: person_name,
      period,
      amount,
      cashflow_recorded: cashflowRecorded,
      trash_recorded: trashRecorded,
      trash_reimbursement_recorded: trashReimbursementRecorded,
      bulk_batch_id: bulkBatchId || null,
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
