import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  listPublicPaymentConfirmations,
  submitPaymentProof,
} from "@/features/paymentProof/paymentProofService";

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
    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.paymentProofSubmit, {
      identity: "client",
      targetId: `${personId}:${period}`,
    });

    if (rateLimit) return rateLimit;

    const supabase = getSupabaseAdmin();
    const result = await submitPaymentProof({ supabase, formData });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal mengirim bukti transfer" }, { status: 500 });
  }
}
