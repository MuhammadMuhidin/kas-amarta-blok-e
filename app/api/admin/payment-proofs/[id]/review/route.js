import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  approvePaymentProof,
  rejectPaymentProof,
} from "@/features/paymentProof/paymentProofService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const id = String(params?.id || "").trim();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.paymentProofReview, {
      identity: "session",
      targetId: `${id}:${action}`,
    });

    if (rateLimit) return rateLimit;

    const supabase = getSupabaseAdmin();
    const result = action === "approve"
      ? await approvePaymentProof({ supabase, req, id })
      : await rejectPaymentProof({ supabase, req, id, reason: body.reason });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses bukti transfer" }, { status: 500 });
  }
}
