import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import {
  findMemberById,
  findPaymentById,
  findTrashAdvanceCashflow,
  findTrashByPaymentId,
  findTrashReimbursementCashflow,
  insertTrash,
  insertTrashReimbursementCashflow,
} from "@/features/trash/trashRepairRepository";

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

export async function repairMissingTrashPayment({ supabase, req, paymentId }) {
  if (!paymentId) {
    return { status: 400, body: { error: "Payment ID is required" } };
  }

  const payment = await findPaymentById(supabase, paymentId);

  if (!payment) {
    return { status: 404, body: { error: "Payment not found" } };
  }

  const member = await findMemberById(supabase, payment.person_id);

  if (!member) {
    return { status: 404, body: { error: "Payment person not found" } };
  }

  if (normalize(member.trash).toUpperCase() !== "Y") {
    return { status: 400, body: { error: "Person is not registered for trash payment" } };
  }

  const existingTrash = await findTrashByPaymentId(supabase, paymentId);

  if (existingTrash) {
    return {
      status: 200,
      body: {
        success: true,
        existing: true,
        trash_id: existingTrash.id,
      },
    };
  }

  const appConfig = await getAppConfig();
  const trashAmount = Number(appConfig?.trash_fee || 0);

  if (!trashAmount) {
    return { status: 400, body: { error: "Tarif sampah belum dikonfigurasi" } };
  }

  const trashId = generateId("TRASH-");
  const date = normalize(payment.date) || new Date().toISOString().slice(0, 10);

  await insertTrash(supabase, {
    id: trashId,
    payment_id: paymentId,
    amount: trashAmount,
    date,
  });

  await recordAdminActivity(req, {
    type: "repair",
    module: "trash",
    severity: "success",
    message: `Repair missing trash record ${payment.person_house || "-"} ${payment.period || "-"}`,
    metadata: {
      trash_id: trashId,
      payment_id: paymentId,
      person_id: payment.person_id,
      house: payment.person_house,
      name: payment.person_name,
      period: payment.period,
      amount: trashAmount,
      date,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      repaired: true,
      trash_id: trashId,
    },
  };
}

export async function repairTrashReimbursement({ supabase, req, paymentId }) {
  if (!paymentId) {
    return { status: 400, body: { error: "Payment ID is required" } };
  }

  const payment = await findPaymentById(supabase, paymentId);

  if (!payment) {
    return { status: 404, body: { error: "Payment not found" } };
  }

  const trash = await findTrashByPaymentId(supabase, paymentId);

  if (!trash) {
    return { status: 400, body: { error: "Trash record is required before reimbursement repair" } };
  }

  const advancePaymentId = buildTrashAdvanceRefId(payment.person_id, payment.period);
  const reimbursementPaymentId = buildTrashReimbursementRefId(paymentId);
  const advance = await findTrashAdvanceCashflow(supabase, advancePaymentId);

  if (!advance) {
    return { status: 404, body: { error: "Trash advance cashflow not found" } };
  }

  const reimbursement = await findTrashReimbursementCashflow(supabase, reimbursementPaymentId);

  if (reimbursement) {
    return {
      status: 200,
      body: {
        success: true,
        existing: true,
        cashflow_id: reimbursement.id,
      },
    };
  }

  const amount = Number(advance.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { error: "Invalid trash advance amount" } };
  }

  const cashflowId = generateId("CSFLOW-");
  const date = normalize(payment.date) || new Date().toISOString().slice(0, 10);
  const note = buildTrashReimbursementNote(payment.person_house, payment.period);

  await insertTrashReimbursementCashflow(supabase, {
    id: cashflowId,
    payment_id: reimbursementPaymentId,
    type: "income",
    amount,
    note,
    date,
    receipt_url: "",
  });

  await recordAdminActivity(req, {
    type: "repair",
    module: "trash",
    severity: "success",
    message: `Repair trash reimbursement ${payment.person_house || "-"} ${payment.period || "-"}`,
    metadata: {
      cashflow_id: cashflowId,
      payment_id: paymentId,
      reimbursement_payment_id: reimbursementPaymentId,
      advance_payment_id: advancePaymentId,
      person_id: payment.person_id,
      house: payment.person_house,
      name: payment.person_name,
      period: payment.period,
      amount,
      date,
      note,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      repaired: true,
      cashflow_id: cashflowId,
    },
  };
}
