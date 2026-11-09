import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

const PAYMENT_PROOFS_TABLE = dbTable("payment_proofs");

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      return Response.json({ error: "payment_id required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from(PAYMENT_PROOFS_TABLE)
      .select("id, proof_key, original_filename, submitted_at, status, reviewed_at, reviewed_by, reject_reason")
      .eq("approved_payment_id", paymentId)
      .eq("status", "approved")
      .limit(1);

    if (error) {
      throw new Error("Gagal membaca bukti pembayaran");
    }

    if (!data?.length) {
      return Response.json({ ok: true, proof: null });
    }

    const proof = data[0];

    return Response.json({
      ok: true,
      proof: {
        id: proof.id,
        original_filename: proof.original_filename || "",
        submitted_at: proof.submitted_at || "",
        status: proof.status,
      },
    });
  } catch (err) {
    console.error("PUBLIC PAYMENT PROOF ERROR:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}