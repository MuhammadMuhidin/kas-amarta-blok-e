import { getAppConfig } from "@/lib/appConfig";
import { generateId } from "@/lib/id";
import { uploadPaymentProof } from "@/lib/r2Upload";
import { sendAdminEmailNotification } from "@/lib/emailNotification";
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

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
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

async function getConfiguredMonthlyFee() {
  const appConfig = await getAppConfig();
  return Number(appConfig?.monthly_fee || 0);
}

function withPaymentVerificationBreakdown(proof, member, appConfig) {
  const cashAmount = Number(proof?.amount || 0);
  const trashAmount = isTrashMember(member) ? Number(appConfig?.trash_fee || 0) : 0;

  return {
    ...proof,
    is_trash_user: isTrashMember(member),
    cash_amount: cashAmount,
    trash_amount: trashAmount,
    total_amount: cashAmount + trashAmount,
  };
}

async function notifyAdminPaymentProofSubmitted({ proof, member, appConfig }) {
  const enrichedProof = withPaymentVerificationBreakdown(proof, member, appConfig);
  const appBaseUrl = getAppBaseUrl();
  const adminUrl = appBaseUrl ? `${appBaseUrl}/admin` : "";
  const subject = `[Amarta Kas] Bukti pembayaran masuk - ${proof.person_house} ${proof.period}`;
  const lines = [
    "Ada bukti pembayaran baru yang perlu diverifikasi admin.",
    "",
    `Rumah: ${proof.person_house}`,
    `Nama: ${proof.person_name || "-"}`,
    `Periode: ${proof.period}`,
    `Status sampah: ${enrichedProof.is_trash_user ? "Ikut sampah" : "Tidak ikut sampah"}`,
    `Kas: ${money(enrichedProof.cash_amount)}`,
    `Sampah: ${enrichedProof.is_trash_user ? money(enrichedProof.trash_amount) : "-"}`,
    `Total untuk dicocokkan: ${money(enrichedProof.total_amount)}`,
    `Waktu submit: ${proof.submitted_at || "-"}`,
    "",
    adminUrl ? `Buka admin: ${adminUrl}` : "Buka dashboard admin untuk review bukti pembayaran.",
  ];
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">Bukti pembayaran masuk</h2>
      <p>Ada bukti pembayaran baru yang perlu diverifikasi admin.</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tbody>
          <tr><td style="padding:6px 0;color:#6b7280">Rumah</td><td style="padding:6px 0;font-weight:700">${proof.person_house}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Nama</td><td style="padding:6px 0;font-weight:700">${proof.person_name || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Periode</td><td style="padding:6px 0;font-weight:700">${proof.period}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Status sampah</td><td style="padding:6px 0;font-weight:700">${enrichedProof.is_trash_user ? "Ikut sampah" : "Tidak ikut sampah"}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Kas</td><td style="padding:6px 0;font-weight:700">${money(enrichedProof.cash_amount)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Sampah</td><td style="padding:6px 0;font-weight:700">${enrichedProof.is_trash_user ? money(enrichedProof.trash_amount) : "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Total dicocokkan</td><td style="padding:6px 0;font-weight:800">${money(enrichedProof.total_amount)}</td></tr>
        </tbody>
      </table>
      ${adminUrl ? `<p><a href="${adminUrl}" style="display:inline-block;margin-top:14px;padding:10px 14px;border-radius:10px;background:#10b981;color:#042f2e;text-decoration:none;font-weight:800">Buka Admin</a></p>` : ""}
    </div>
  `;

  try {
    await sendAdminEmailNotification({ subject, text: lines.join("\n"), html });
  } catch (error) {
    console.error("Gagal mengirim email notifikasi bukti pembayaran", error);
  }
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

  await notifyAdminPaymentProofSubmitted({ proof, member, appConfig });

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
