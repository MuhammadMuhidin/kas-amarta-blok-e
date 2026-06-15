import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";
import { listPublicPaymentConfirmations, submitPaymentProof } from "@/features/paymentProof/paymentProofService";
import { findPaymentProofById } from "@/features/paymentProof/paymentProofRepository";
import { queuePaymentProofSubmittedNotification } from "@/lib/notificationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const result = await listPublicPaymentConfirmations(supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca konfirmasi pembayaran" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const personId = String(formData.get("person_id") || "").trim();
    const period = String(formData.get("period") || "").trim().slice(0, 7);
    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.paymentProofSubmit, { identity: "client", targetId: `${personId}:${period}` });
    if (rateLimit) return rateLimit;

    const supabase = getSupabaseAdmin();
    const result = await submitPaymentProof({ supabase, formData });
    let telegramQueue = { queued: false, reason: "business_not_completed" };

    if (result.status < 400 && result.body?.proof?.id) {
      try {
        const proof = await findPaymentProofById(supabase, result.body.proof.id);
        telegramQueue = await queuePaymentProofSubmittedNotification({
          proof: proof || result.body.proof,
          totalAmount: Number(proof?.amount || result.body.proof.amount || 0) + Number(proof?.trash_amount || result.body.proof.trash_amount || 0),
        });
      } catch (error) {
        console.error("Payment proof saved but Telegram queue integration failed", error);
        telegramQueue = { queued: false, reason: error instanceof Error ? error.message : "integration_failed" };
      }
    }

    return NextResponse.json({ ...result.body, telegram_queue: telegramQueue }, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal mengirim bukti transfer" }, { status: 500 });
  }
}
