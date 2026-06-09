import { supabase } from "@/lib/supabase";

export async function fetchBackupSummary() {
  const { data, error } = await supabase.rpc("tracelog_backup_summary");

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data : [];
}
