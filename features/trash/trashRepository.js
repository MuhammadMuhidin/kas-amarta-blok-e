import { dbTable } from "@/lib/dbTable";

const TRASH_TABLE = dbTable("trash");

export function mapTrash(row) {
  return {
    id: row.id,
    payment_id: row.payment_id,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

export async function listTrash(supabase) {
  const { data: rows, error } = await supabase
    .from(TRASH_TABLE)
    .select("id,payment_id,amount,date");

  if (error) {
    throw new Error("Gagal membaca data sampah");
  }

  return (rows || []).map(mapTrash);
}

export async function findTrashByPaymentId(supabase, paymentId) {
  const { data: rows, error } = await supabase
    .from(TRASH_TABLE)
    .select("id,payment_id,amount,date")
    .eq("payment_id", paymentId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data sampah");
  }

  return rows?.[0] || null;
}

export async function insertTrash(supabase, trash) {
  const { error } = await supabase.from(TRASH_TABLE).insert(trash);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan data sampah");
  }
}
