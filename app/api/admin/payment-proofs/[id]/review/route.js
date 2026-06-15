import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";
import { approvePaymentProof, rejectPaymentProof } from "@/features/paymentProof/paymentProofService";
import { queuePaymentProofDecisionNotification } from "@/lib/notificationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const id = String(params?.id || "").trim();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const rateLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.paymentProofReview, { identity: "session", targetId: `${id}:${action}` });
    if (rateLimit) return rateLimit;

    const session = await getCurrentAdminSession(req);
    const supabase = getSupabaseAdmin();
    const result = action === "approve"
      ? await approvePaymentProof({ supabase, req, id })
      : await rejectPaymentProof({ supabase, req, id, reason: body.reason });

    let telegramQueue = { queued: false, reason: "business_not_completed" };
    if (result.status < 400 && result.body?.proof) {
      telegramQueue = await queuePaymentProofDecisionNotification({
        proof: result.body.proof,
        action,
        actorName: session?.access_role || "admin",
        actorRole: session?.access_role || "admin",
        reason: body.reason,
        source: "web",
      });
    }

    return NextResponse.json({ ...result.body, telegram_queue: telegramQueue }, { status: result.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses bukti transfer" }, { status: 500 });
  }
}
