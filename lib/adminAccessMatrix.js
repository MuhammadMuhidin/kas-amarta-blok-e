import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAdminAccessRole } from "@/lib/adminRoles";
import { ADMIN_MODULES, filterKnownAdminModules } from "@/lib/adminModules";

const ROLE_ACCESS_MATRIX_TABLE = dbTable("role_access_matrix");

function defaultModulesFor(role) {
  if (role === "admin") return ADMIN_MODULES.map((module) => module.key);
  return ["overview"];
}

export async function getAllowedAdminModules(accessRole) {
  const role = resolveAdminAccessRole(accessRole);

  if (role === "admin") {
    return ADMIN_MODULES.map((module) => module.key);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROLE_ACCESS_MATRIX_TABLE)
    .select("module_key,is_visible")
    .eq("access_role", role)
    .eq("is_visible", true);

  if (error) {
    throw new Error(error.message || "Gagal membaca matrix akses");
  }

  const keys = (data || []).map((item) => item.module_key);
  const modules = filterKnownAdminModules(keys);

  return modules.length ? modules.map((module) => module.key) : defaultModulesFor(role);
}
