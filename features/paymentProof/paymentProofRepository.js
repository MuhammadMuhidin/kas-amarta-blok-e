import { dbTable } from "@/lib/dbTable";
import { withMediaPaymentProofUrl } from "@/lib/mediaUrl";

const PAYMENT_PROOFS_TABLE = dbTable("payment_proofs");
const PERSONAL_TABLE = dbTable("personal");
const PAYMENT_TABLE = dbTable("payment");

export function mapPaymentProof(row = {}) {
  return withMediaPaymentProofUrl({
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    person_name: row.person_name,
    period: row.period,
    amount: Number(row.amount) || 0,
    proof_url: row.proof_url || "",
    proof_key: row.proof_key || "",
    proof_mime_type: row.proof_mime_type || "",
    proof_size: Number(row.proof_size || 0),
    original_filename: row.original_filename || "",
    status: row.status || "pending",
    submitted_at: row.submitted_at || "",
    reviewed_at: row.reviewed_at || "",
    reviewed_by: row.reviewed_by || "",
    approved_payment_id: row.approved_payment_id || "",
    reject_reason: row.reject_reason || "",
  });
}

export async function findActiveMemberById(supabase, personId) {
  const { data, error } = await supabase
    .from(PERSONAL_TABLE)
    .select("id,house,name,trash,active,join_date")
    .eq("id", personId)
    .limit(1);

  if (error) throw new Error(error.message || "Gagal membaca data warga");

  return data?.[0] || null;
}

export async function findPaymentByPersonPeriod(supabase, { personId, house, period }) {
  const { data, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("id,person_id,person_house,person_name,period,amount,date")
    .eq("period", period)
    .or(`person_id.eq.${personId},person_house.eq.${house}`)
    .limit(1);

  if (error) throw new Error(error.message || "Gagal membaca payment");

  return data?.[0] || null;
}

export async function findOpenPaymentProof(supabase, { personId, period }) {
  const { data, error } = await supabase
    .from(PAYMENT_PROOFS_TABLE)
    .select("id,person_id,period,status")
    .eq("person_id", personId)
    .eq("period", period)
    .eq("status", "pending")
    .limit(1);

  if (error) throw new Error(error.message || "Gagal membaca konfirmasi pembayaran");

  return data?.[0] || null;
}

export async function insertPaymentProof(supabase, proof) {
  const { data, error } = await supabase
    .from(PAYMENT_PROOFS_TABLE)
    .insert(proof)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Gagal menyimpan bukti transfer");

  return mapPaymentProof(data);
}

export async function listPaymentProofs(supabase, { status = "", period = "" } = {}) {
  let query = supabase
    .from(PAYMENT_PROOFS_TABLE)
    .select("*")
    .order("submitted_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (period) query = query.eq("period", period);

  const { data, error } = await query;

  if (error) throw new Error(error.message || "Gagal membaca bukti transfer");

  return (data || []).map(mapPaymentProof);
}

export async function listPublicPaymentProofs(supabase) {
  const { data, error } = await supabase
    .from(PAYMENT_PROOFS_TABLE)
    .select("id,person_id,person_house,period,status,submitted_at,reviewed_at,reject_reason,approved_payment_id")
    .in("status", ["pending", "approved", "rejected"])
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message || "Gagal membaca konfirmasi pembayaran");

  return (data || []).map((row) => ({
    id: row.id,
    person_id: row.person_id,
    person_house: row.person_house,
    period: row.period,
    status: row.status,
    submitted_at: row.submitted_at || "",
    reviewed_at: row.reviewed_at || "",
    reject_reason: row.reject_reason || "",
    approved_payment_id: row.approved_payment_id || "",
  }));
}

export async function findPaymentProofById(supabase, id) {
  const { data, error } = await supabase
    .from(PAYMENT_PROOFS_TABLE)
    .select("*")
    .eq("id", id)
    .limit(1);

  if (error) throw new Error(error.message || "Gagal membaca bukti transfer");

  return data?.[0] ? mapPaymentProof(data[0]) : null;
}

export async function updatePaymentProof(supabase, id, patch) {
  const { data, error } = await supabase
    .from(PAYMENT_PROOFS_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Gagal mengubah bukti transfer");

  return mapPaymentProof(data);
}
