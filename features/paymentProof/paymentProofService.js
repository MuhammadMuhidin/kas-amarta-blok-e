import { getAppConfig } from "@/lib/appConfig";
import { generateId } from "@/lib/id";
import { uploadPaymentProof } from "@/lib/r2Upload";
import { sendAlertEmail } from "@/lib/emailAlert";
import { formatJakartaDateTime, getJakartaDateString } from "@/lib/localDate";
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

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function normalize(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatPeriod(value) {
  const normalized = normalize(value);
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) return normalized || "-";
  const month = MONTH_NAMES[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : normalized;
}

function formatSubmittedAt(value) {
  return value ? `${formatJakartaDateTime(value, "id-ID")} WIB` : "-";
}

function isActiveMember(member) {
  return ["Y", "YES", "TRUE", "1"].includes(normalizeUpper(member?.active));
}

function isTrashMember(member) {
  return normalizeUpper(member?.trash) === "Y";
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

function getAppBaseUrl() {
  return normalize(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)
    .replace(/\/$/, "");
}

function getActivityContext({ actor, actorRole, source, actorMetadata }) {
  const role = normalize(actorRole).toLowerCase() || "admin";
  return {
    actor: normalize(actor) || role,
    role,
    source: normalize(source) || "web",
    metadata: actorMetadata && typeof actorMetadata === "object" ? actorMetadata : {},
  };
}

async function getConfiguredMonthlyFee() {
  const appConfig = await getAppConfig();
  return Number(appConfig?.monthly_fee || 0);
}

function getProofTrashAmount(proof, member, appConfig) {
  const storedTrashAmount = Number(proof?.trash_amount || 0);
  if (storedTrashAmount > 0) return storedTrashAmount;
  return isTrashMember(member) ? Number(appConfig?.trash_fee || 0) : 0;
}

function withPaymentVerificationBreakdown(proof, member, appConfig) {
  const cashAmount = Number(proof?.amount || 0);
  const trashAmount = getProofTrashAmount(proof, member, appConfig);

  return {
    ...proof,
    is_trash_user: trashAmount > 0,
    cash_amount: cashAmount,
    trash_amount: trashAmount,
    total_amount: cashAmount + trashAmount,
  };
}

function buildPaymentProofAlertMessage({ proof, member, appConfig }) {
  const enrichedProof = withPaymentVerificationBreakdown(proof, member, appConfig);
  const appBaseUrl = getAppBaseUrl();
  const adminUrl = appBaseUrl ? `${appBaseUrl}/admin` : "";

  return [
    "Bukti Pembayaran Baru",
    "",
    `Rumah: ${proof.person_house}`,
    `Nama: ${proof.person_name || "-"}`,
    `Periode: ${formatPeriod(proof.period)}`,
    `Kas: ${money(enrichedProof.cash_amount)}`,
    `Sampah: ${enrichedProof.trash_amount > 0 ? money(enrichedProof.trash_amount) : "-"}`,
    `Total: ${money(enrichedProof.total_amount)}`,
    "Status: Menunggu Verifikasi",
    `Dikirim: ${formatSubmittedAt(proof.submitted_at)}`,
    "",
    adminUrl ? `Tinjau di Admin:\n${adminUrl}` : "Tinjau melalui dashboard Admin.",
  ].join("\n");
}

async function notifyAdminPaymentProofSubmitted({ proof, member, appConfig }) {
  const message = buildPaymentProofAlertMessage({ proof, member, appConfig });
  const fallbackName = `bukti-pembayaran-${proof.person_house}-${proof.period}`;

  return sendAlertEmail({
    message,
    period: proof.period,
    source: "payment-proof-upload",
    subject: `[Amarta Kas] Bukti Pembayaran Baru - ${proof.person_house} - ${formatPeriod(proof.period)}`,
    attachments: proof.proof_url
      ? [{ path: proof.proof_url, filename: proof.original_filename || fallbackName }]
      : [],
  });
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

  const appConfig = await getAppConfig();
  const amount = Number(appConfig?.monthly_fee || 0);

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
    trash_amount: isTrashMember(member) ? Number(appConfig?.trash_fee || 0) : 0,
    proof_url: uploaded.url,
    proof_key: uploaded.key,
    proof_mime_type: file?.type || "",
    proof_size: Number(file?.size || 0),
    original_filename: getFileName(file),
    status: "pending",
    submitted_at: submittedAt,
    reviewed_at: null,
    reviewed_by: "",
    approved_payment_id: "",
    reject_reason: "",
  });

  const email = await notifyAdminPaymentProofSubmitted({ proof, member, appConfig });

  return {
    status: 200,
    body: {
      ok: true,
      status: proof.status,
      email,
      proof: {
        id: proof.id,
        person_id: proof.person_id,
        person_house: proof.person_house,
        period: proof.period,
        amount: proof.amount,
        trash_amount: proof.trash_amount,
        status: proof.status,
        submitted_at: proof.submitted_at,
      },
    },
  };
}

export async function listAdminPaymentProofs({ supabase, searchParams }) {
  const status = normalize(searchParams.get("status"));
  const period = normalize(searchParams.get("period")).slice(0, 7);
  const appConfig = await getAppConfig();
  const proofs = await listPaymentProofs(supabase, {
    status,
    period: isValidPeriod(period) ? period : "",
  });
  const enrichedProofs = await Promise.all(
    proofs.map(async (proof) => {
      const member = await findActiveMemberById(supabase, proof.person_id).catch(() => null);
      return withPaymentVerificationBreakdown(proof, member, appConfig);
    }),
  );

  return { ok: true, proofs: enrichedProofs };
}

export async function approvePaymentProof({
  supabase,
  req,
  id,
  actor = "admin",
  actorRole = "admin",
  source = "web",
  actorMetadata = {},
}) {
  const proof = await findPaymentProofById(supabase, id);
  const activity = getActivityContext({ actor, actorRole, source, actorMetadata });

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
      today: getJakartaDateString(),
    });

    if (result.status >= 400) return result;

    paymentId = result.body?.payment_id || "";
  }

  const reviewedAt = new Date().toISOString();
  const updated = await updatePaymentProof(supabase, proof.id, {
    status: "approved",
    reviewed_at: reviewedAt,
    reviewed_by: activity.actor,
    approved_payment_id: paymentId,
    reject_reason: "",
  });

  await recordAdminActivity(req, {
    type: "approve",
    module: "payment-proof",
    severity: "success",
    actor: activity.actor,
    message: `Approve payment proof ${proof.person_house} ${proof.period}`,
    metadata: {
      proof_id: proof.id,
      payment_id: paymentId,
      existing_payment: Boolean(existingPayment),
      person_id: proof.person_id,
      house: proof.person_house,
      period: proof.period,
      amount: proof.amount,
      trash_amount: proof.trash_amount,
      source: activity.source,
      role: activity.role,
      ...activity.metadata,
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

export async function rejectPaymentProof({
  supabase,
  req,
  id,
  reason,
  actor = "admin",
  actorRole = "admin",
  source = "web",
  actorMetadata = {},
}) {
  const proof = await findPaymentProofById(supabase, id);
  const rejectReason = normalize(reason);
  const activity = getActivityContext({ actor, actorRole, source, actorMetadata });

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
    reviewed_by: activity.actor,
    reject_reason: rejectReason,
  });

  await recordAdminActivity(req, {
    type: "reject",
    module: "payment-proof",
    severity: "warning",
    actor: activity.actor,
    message: `Reject payment proof ${proof.person_house} ${proof.period}`,
    metadata: {
      proof_id: proof.id,
      person_id: proof.person_id,
      house: proof.person_house,
      period: proof.period,
      amount: proof.amount,
      trash_amount: proof.trash_amount,
      reason: rejectReason,
      source: activity.source,
      role: activity.role,
      ...activity.metadata,
    },
  });

  return { status: 200, body: { ok: true, proof: updated } };
}

export async function getDefaultPaymentProofAmount() {
  return getConfiguredMonthlyFee();
}
