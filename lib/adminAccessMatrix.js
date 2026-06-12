import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAdminAccessRole } from "@/lib/adminRoles";
import { ADMIN_MODULES, filterKnownAdminModules } from "@/lib/adminModules";

const ROLE_ACCESS_MATRIX_TABLE = dbTable("role_access_matrix");
const FORCED_VISIBLE_MODULES = ["overview"];
const FORCED_HIDDEN_MODULES = ["settings", "role_management"];

function defaultModulesFor(role) {
  if (role === "admin") return ADMIN_MODULES.map((module) => module.key);
  return FORCED_VISIBLE_MODULES;
}

function normalizeAllowedModules(role, keys = []) {
  if (role === "admin") {
    return ADMIN_MODULES.map((module) => module.key);
  }

  const allowed = new Set([...defaultModulesFor(role), ...(keys || [])]);

  for (const key of FORCED_HIDDEN_MODULES) {
    allowed.delete(key);
  }

  return filterKnownAdminModules([...allowed]).map((module) => module.key);
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

  return normalizeAllowedModules(role, keys);
}
