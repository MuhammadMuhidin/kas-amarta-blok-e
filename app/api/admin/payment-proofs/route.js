import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { listAdminPaymentProofs } from "@/features/paymentProof/paymentProofService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const { searchParams } = new URL(req.url);
    const supabase = getSupabaseAdmin();
    const result = await listAdminPaymentProofs({ supabase, searchParams });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca bukti transfer" }, { status: 500 });
  }
}
