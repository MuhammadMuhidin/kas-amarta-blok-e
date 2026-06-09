import { dbTable } from "@/lib/dbTable";

const PAYMENT_TABLE = dbTable("payment");

export function mapPayment(row) {
  return {
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    person_name: row.person_name,
    period: row.period,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

export async function listPayments(supabase) {
  const { data: rows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date");

  if (error) {
    throw new Error("Gagal membaca payment");
  }

  return (rows || []).map(mapPayment);
}
