import { getAppConfig } from "@/lib/appConfig";
import { generateId } from "@/lib/id";
import { uploadPaymentProof } from "@/lib/r2Upload";
import { recordAdminActivity } from "@/lib/adminActivity";
import { recordPayment } from "@/features/payment/paymentService";
import {
  findActiveMemberById,
  findOpenPaymentProof,
  findPaymentByPersonPeriod,
  findPaymentProofById,
  insertPaymentProof,
  listPaymentProofs,
  listPublicPaymentProofs,
  updatePaymentProof,
} from "@/features/paymentProof/paymentProofRepository";

function normalize(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function isActiveMember(member) {
  return ["Y", "YES", "TRUE", "1"].includes(normalizeUpper(member?.active));
}

function isValidPeriod(period) {
  return /^\d{4}-\d{2}$/.test(period);
}

function isJoinedByPeriod(member, period) {
  const joinPeriod = normalize(member?.join_date).slice(0, 7);
  return !joinPeriod || joinPeriod <= period;
}

function getFileName(file) {
  return normalize(file?.name);
}

async function getConfiguredMonthlyFee() {
  const appConfig = await getAppConfig();
  return Number(appConfig?.monthly_fee || 0);
}

export async function listPublicPaymentConfirmations(supabase) {
  const confirmations = await listPublicPaymentProofs(supabase);

  return { ok: true, confirmations };
}

export async function submitPaymentProof({ supabase, formData }) {
  const personId = normalize(formData.get("person_id"));
  const period = normalize(formData.get("period")).slice(0, 7);
  const file = formData.get("proof");

  if (!personId || !isValidPeriod(period)) {
    return { status: 400, body: { error: "Data rumah dan periode wajib diisi" } };
  }

  const amount = await getConfiguredMonthlyFee();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { error: "Nominal kas bulanan belum dikonfigurasi" } };
  }

  const member = await findActiveMemberById(supabase, personId);

  if (!member || !isActiveMember(member)) {
    return { status: 404, body: { error: "Rumah tidak ditemukan atau tidak aktif" } };
  }

  if (!isJoinedByPeriod(member, period)) {
    return { status: 400, body: { error: "Rumah belum bergabung pada periode ini" } };
  }

  const existingPayment = await findPaymentByPersonPeriod(supabase, {
    personId,
    house: member.house,
    period,
  });

  if (existingPayment) {
    return { status: 409, body: { error: "Pembayaran periode ini sudah tercatat" } };
  }

  const existingProof = await findOpenPaymentProof(supabase, { personId, period });

  if (existingProof) {
    return { status: 409, body: { error: "Bukti pembayaran sudah dikirim dan menunggu persetujuan admin" } };
  }

  const proofId = generateId("PAYPROOF-");
  const uploaded = await uploadPaymentProof(file, { proofId });
  const submittedAt = new Date().toISOString();
  const proof = await insertPaymentProof(supabase, {
    id: proofId,
    person_id: personId,
    person_house: member.house,
    person_name: member.name,
    period,
    amount,
    proof_url: uploaded.url,
    proof_key: uploaded.key,
    proof_mime_type: file?.type || "",
    proof_size: Number(file?.size || 0),
    original_filename: getFileName(file),
    note: "",
    status: "pending",
    submitted_at: submittedAt,
    reviewed_at: null,
    reviewed_by: "",
    approved_payment_id: "",
    reject_reason: "",
  });

  return {
    status: 200,
    body: {
      ok: true,
      status: proof.status,
      proof: {
        id: proof.id,
        person_id: proof.person_id,
        person_house: proof.person_house,
        period: proof.period,
        amount: proof.amount,
        status: proof.status,
        submitted_at: proof.submitted_at,
      },
    },
  };
}

export async function listAdminPaymentProofs({ supabase, searchParams }) {
  const status = normalize(searchParams.get("status"));
  const period = normalize(searchParams.get("period")).slice(0, 7);
  const proofs = await listPaymentProofs(supabase, {
    status,
    period: isValidPeriod(period) ? period : "",
  });

  return { ok: true, proofs };
}

export async function approvePaymentProof({ supabase, req, id }) {
  const proof = await findPaymentProofById(supabase, id);

  if (!proof) {
    return { status: 404, body: { error: "Bukti pembayaran tidak ditemukan" } };
  }

  if (proof.status !== "pending") {
    return { status: 409, body: { error: "Bukti pembayaran sudah diproses" } };
  }

  const existingPayment = await findPaymentByPersonPeriod(supabase, {
    personId: proof.person_id,
    house: proof.person_house,
    period: proof.period,
  });
  let paymentId = existingPayment?.id || "";
  let result = null;

  if (!existingPayment) {
    result = await recordPayment({
      supabase,
      req,
      house: proof.person_house,
      period: proof.period,
      amount: proof.amount,
      bulkBatchId: "",
      today: new Date().toISOString().slice(0, 10),
    });

    if (result.status >= 400) return result;

    paymentId = result.body?.payment_id || "";
  }

  const reviewedAt = new Date().toISOString();
  const updated = await updatePaymentProof(supabase, proof.id, {
    status: "approved",
    reviewed_at: reviewedAt,
    reviewed_by: "admin",
    approved_payment_id: paymentId,
    reject_reason: "",
  });

  await recordAdminActivity(req, {
    type: "approve",
    module: "payment-proof",
    severity: "success",
    message: `Approve payment proof ${proof.person_house} ${proof.period}`,
    metadata: {
      proof_id: proof.id,
      payment_id: paymentId,
      existing_payment: Boolean(existingPayment),
      person_id: proof.person_id,
      house: proof.person_house,
      period: proof.period,
      amount: proof.amount,
    },
  });

  return {
    status: 200,
    body: {
      ok: true,
      proof: updated,
      payment_id: paymentId,
      payment_result: result?.body || null,
    },
  };
}

export async function rejectPaymentProof({ supabase, req, id, reason }) {
  const proof = await findPaymentProofById(supabase, id);
  const rejectReason = normalize(reason);

  if (!proof) {
    return { status: 404, body: { error: "Bukti pembayaran tidak ditemukan" } };
  }

  if (proof.status !== "pending") {
    return { status: 409, body: { error: "Bukti pembayaran sudah diproses" } };
  }

  if (!rejectReason) {
    return { status: 400, body: { error: "Alasan penolakan wajib diisi" } };
  }

  const updated = await updatePaymentProof(supabase, proof.id, {
    status: "rejected",
    reviewed_at: new Date().toISOString(),
    reviewed_by: "admin",
    reject_reason: rejectReason,
  });

  await recordAdminActivity(req, {
    type: "reject",
    module: "payment-proof",
    severity: "warning",
    message: `Reject payment proof ${proof.person_house} ${proof.period}`,
    metadata: {
      proof_id: proof.id,
      person_id: proof.person_id,
      house: proof.person_house,
      period: proof.period,
      amount: proof.amount,
      reason: rejectReason,
    },
  });

  return { status: 200, body: { ok: true, proof: updated } };
}

export async function getDefaultPaymentProofAmount() {
  return getConfiguredMonthlyFee();
}
