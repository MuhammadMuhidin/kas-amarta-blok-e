import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";
import { assertAdminAccessRole } from "@/lib/adminRoles";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");

export async function getAdminRoleContact(role) {
  const normalizedRole = assertAdminAccessRole(role);
  const supabase = getSupabaseAdmin();

  const result = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role,phone,active")
    .eq("role", normalizedRole)
    .eq("active", true)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message || "Failed to read role contact");
  }

  if (!result.data?.phone) {
    throw new Error("Role WhatsApp number is not configured");
  }

  return result.data;
}
