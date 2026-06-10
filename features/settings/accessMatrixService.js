import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_ACCESS_ROLES, assertAdminAccessRole, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import { ADMIN_MODULES, normalizeAdminModuleKey } from "@/lib/adminModules";
import { recordAdminActivity } from "@/lib/adminActivity";

const ROLE_ACCESS_MATRIX_TABLE = dbTable("role_access_matrix");
const EDITABLE_ROLES = ADMIN_ACCESS_ROLES.filter((role) => role.value !== "admin");

function isLocked(role, moduleKey) {
  if (role === "admin") return true;
  if (moduleKey === "overview") return true;
  if (moduleKey === "settings") return true;
  return false;
}

function forcedValue(role, moduleKey, value) {
  if (role === "admin") return true;
  if (moduleKey === "overview") return true;
  if (moduleKey === "settings") return false;
  return Boolean(value);
}

function ensureEditableRole(role) {
  const value = assertAdminAccessRole(role);
  if (value === "admin") throw new Error("Role admin selalu full access dan tidak perlu diedit");
  return value;
}

function buildMatrixRows(role, rows = []) {
  const rowMap = new Map(rows.map((row) => [row.module_key, Boolean(row.is_visible)]));

  return ADMIN_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    visible: forcedValue(role, module.key, rowMap.get(module.key)),
    locked: isLocked(role, module.key),
  }));
}

export async function getAccessMatrixSettings(role) {
  const selectedRole = ensureEditableRole(role || EDITABLE_ROLES[0]?.value);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(ROLE_ACCESS_MATRIX_TABLE)
    .select("module_key,is_visible")
    .eq("access_role", selectedRole);

  if (error) {
    throw new Error(error.message || "Gagal membaca matrix access");
  }

  return {
    ok: true,
    role: selectedRole,
    roles: EDITABLE_ROLES,
    modules: buildMatrixRows(selectedRole, data || []),
  };
}

export async function updateAccessMatrixSetting({ req, role, moduleKey, isVisible }) {
  const selectedRole = ensureEditableRole(role);
  const normalizedModuleKey = normalizeAdminModuleKey(moduleKey);

  if (!normalizedModuleKey) throw new Error("Module tidak valid");
  if (isLocked(selectedRole, normalizedModuleKey)) throw new Error("Module ini dikunci dan tidak bisa diubah");

  const nextVisible = forcedValue(selectedRole, normalizedModuleKey, isVisible);
  const supabase = getSupabaseAdmin();

  const { data: previous } = await supabase
    .from(ROLE_ACCESS_MATRIX_TABLE)
    .select("is_visible")
    .eq("access_role", selectedRole)
    .eq("module_key", normalizedModuleKey)
    .maybeSingle();

  const { error } = await supabase
    .from(ROLE_ACCESS_MATRIX_TABLE)
    .upsert(
      {
        access_role: selectedRole,
        module_key: normalizedModuleKey,
        is_visible: nextVisible,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "access_role,module_key" },
    );

  if (error) {
    throw new Error(error.message || "Gagal update matrix access");
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "settings-access-matrix",
    severity: "success",
    message: `Update access ${getAdminAccessRoleLabel(selectedRole)} - ${normalizedModuleKey}`,
    metadata: {
      access_role: selectedRole,
      module_key: normalizedModuleKey,
      old_value: previous?.is_visible ?? null,
      new_value: nextVisible,
    },
  });

  return getAccessMatrixSettings(selectedRole);
}
