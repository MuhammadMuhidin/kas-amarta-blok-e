import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");
const ROLE_VALUES = new Set(ADMIN_ACCESS_ROLES.map((role) => role.value));

function clean(value) {
  return String(value || "").trim();
}

function assertRole(value) {
  const role = clean(value).toLowerCase();
  if (!ROLE_VALUES.has(role)) throw new Error("Invalid role");
  return role;
}

function normalizeTelegramUserId(value) {
  const id = clean(value);
  if (!id) return "";
  if (!/^\d{1,20}$/.test(id)) {
    throw new Error("Telegram User ID must contain 1-20 digits");
  }
  return id;
}

export async function getRoleTelegramContacts() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("*");

  if (error) throw new Error(error.message || "Failed to read Telegram role contacts");

  const byRole = new Map((data || []).map((item) => [item.role, item]));
  return ADMIN_ACCESS_ROLES.map((role) => {
    const contact = byRole.get(role.value) || {};
    return {
      role: role.value,
      label: role.label,
      display_name: contact.display_name || contact.name || role.label,
      active: contact.active === true,
      telegram_user_id: contact.telegram_user_id || "",
      updated_at: contact.updated_at || "",
    };
  });
}

export async function updateRoleTelegramContact({ req, role, telegramUserId }) {
  const selectedRole = assertRole(role);
  const cleanTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const supabase = getSupabaseAdmin();

  if (cleanTelegramUserId) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .select("role")
      .eq("telegram_user_id", cleanTelegramUserId)
      .neq("role", selectedRole)
      .limit(1);

    if (duplicateError) throw new Error(duplicateError.message || "Failed to validate Telegram User ID");
    if (duplicate?.length) {
      throw new Error(`Telegram User ID is already assigned to ${duplicate[0].role}`);
    }
  }

  const { data: existing, error: readError } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role,active")
    .eq("role", selectedRole)
    .limit(1);

  if (readError) throw new Error(readError.message || "Failed to read role contact");

  if (existing?.length) {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .update({ telegram_user_id: cleanTelegramUserId || null })
      .eq("role", selectedRole);
    if (error) throw new Error(error.message || "Failed to update Telegram User ID");
  } else {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .insert({
        role: selectedRole,
        phone: "",
        telegram_user_id: cleanTelegramUserId || null,
        active: selectedRole === "admin",
      });
    if (error) throw new Error(error.message || "Failed to create Telegram role contact");
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "role-management",
    severity: "success",
    message: `Update Telegram User ID for ${selectedRole}`,
    metadata: {
      access_role: "admin",
      target_role: selectedRole,
      active: existing?.[0]?.active ?? selectedRole === "admin",
      has_telegram_user_id: Boolean(cleanTelegramUserId),
    },
  });

  return { ok: true };
}
