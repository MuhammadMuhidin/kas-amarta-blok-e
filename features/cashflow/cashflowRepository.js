import { dbTable } from "@/lib/dbTable";
import { withMediaReceiptUrl } from "@/lib/mediaUrl";

const CASHFLOW_TABLE = dbTable("cashflow");

export function mapCashflow(row) {
  return withMediaReceiptUrl({
    id: row.id,
    ref_id: row.payment_id,
    payment_id: row.payment_id,
    type: (row.type || "").toLowerCase(),
    amount: Number(row.amount) || 0,
    note: row.note,
    date: row.date,
    receipt_url: row.receipt_url || "",
  });
}

export async function listCashflows(supabase) {
  const { data: rows, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id,payment_id,type,amount,note,date,receipt_url");

  if (error) {
    throw new Error("Gagal membaca cashflow");
  }

  return (rows || []).map(mapCashflow);
}

export async function insertCashflow(supabase, cashflow) {
  const { error } = await supabase.from(CASHFLOW_TABLE).insert(cashflow);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan cashflow");
  }
}
