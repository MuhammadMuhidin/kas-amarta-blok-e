import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const CASHFLOW_TABLE = dbTable("cashflow");

export async function getLatestReceiptUrl() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("date,receipt_url")
    .not("receipt_url", "is", null)
    .neq("receipt_url", "")
    .order("date", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca sample receipt_url.");
  }

  return data?.[0]?.receipt_url || "";
}
