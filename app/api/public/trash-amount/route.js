import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";

const TRASH_TABLE = dbTable("trash");

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
      .from(TRASH_TABLE)
      .select("amount")
      .eq("payment_id", paymentId)
      .limit(1);

    if (error) {
      throw new Error("Gagal membaca data sampah");
    }

    const trashAmount = data?.[0] ? Number(data[0].amount) || 0 : 0;

    return Response.json({
      ok: true,
      trash_amount: trashAmount,
    });
  } catch (err) {
    console.error("PUBLIC TRASH AMOUNT ERROR:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}