import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { repairTrashReimbursement } from "@/features/trash/trashRepairService";

export const dynamic = "force-dynamic";

function normalize(value) {
  return String(value || "").trim();
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = normalize(body.payment_id);
    const supabase = getSupabaseAdmin();
    const result = await repairTrashReimbursement({ supabase, req, paymentId });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
