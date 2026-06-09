import { dbTable } from "@/lib/dbTable";

const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");
const CASHFLOW_TABLE = dbTable("cashflow");
const TRASH_TABLE = dbTable("trash");

export async function findPaymentById(supabase, paymentId) {
  const { data: rows, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date")
    .eq("id", paymentId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca payment");
  }

  return rows?.[0] || null;
}

export async function findMemberById(supabase, personId) {
  const { data: rows, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("id", personId)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca data warga");
  }

  return rows?.[0] || null;
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

export async function findTrashAdvanceCashflow(supabase, advancePaymentId) {
  const { data: rows, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id,payment_id,type,amount,note,date")
    .eq("payment_id", advancePaymentId)
    .eq("type", "expense")
    .limit(1);

  if (error) {
    throw new Error(error.message || "Gagal membaca cashflow talangan sampah");
  }

  return rows?.[0] || null;
}

export async function findTrashReimbursementCashflow(supabase, reimbursementPaymentId) {
  const { data: rows, error } = await supabase
    .from(CASHFLOW_TABLE)
    .select("id,payment_id,type,amount,note,date")
    .eq("payment_id", reimbursementPaymentId)
    .limit(2);

  if (error) {
    throw new Error(error.message || "Gagal membaca cashflow pengembalian talangan sampah");
  }

  return rows?.[0] || null;
}

export async function insertTrashReimbursementCashflow(supabase, cashflow) {
  const { error } = await supabase.from(CASHFLOW_TABLE).insert(cashflow);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan cashflow pengembalian talangan sampah");
  }
}
