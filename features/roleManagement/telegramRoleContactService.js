import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");
const ROLE_LIST = ADMIN_ACCESS_ROLES.map((role) => role.value);
const ROLE_VALUES = new Set(ROLE_LIST);

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

async function assertTelegramUserIdAvailable(supabase, telegramUserId, selectedRole) {
  if (!telegramUserId) return;

  const { data, error } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role")
    .eq("telegram_user_id", telegramUserId)
    .neq("role", selectedRole)
    .limit(1);

  if (error) {
    throw new Error(error.message || "Failed to validate Telegram User ID");
  }

  if (data?.length) {
    throw new Error(`Telegram User ID is already assigned to ${data[0].role}`);
  }
}

export async function getRoleTelegramContacts() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("*")
    .in("role", ROLE_LIST);

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

export async function enrichRoleContactsWithTelegram(rows = []) {
  const telegramContacts = await getRoleTelegramContacts();
  const telegramByRole = new Map(
    telegramContacts.map((contact) => [contact.role, contact.telegram_user_id || ""]),
  );

  return (rows || []).map((row) => ({
    ...row,
    telegram_user_id: telegramByRole.get(row.role) || "",
  }));
}

export async function updateRoleContactChannels({
  req,
  role,
  phone,
  telegramUserId,
}) {
  const selectedRole = assertRole(role);
  const cleanPhone = clean(phone);
  const cleanTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const supabase = getSupabaseAdmin();

  await assertTelegramUserIdAvailable(
    supabase,
    cleanTelegramUserId,
    selectedRole,
  );

  const { data: existing, error: readError } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role,active")
    .eq("role", selectedRole)
    .limit(1);

  if (readError) throw new Error(readError.message || "Failed to read role contact");

  const payload = {
    phone: cleanPhone,
    telegram_user_id: cleanTelegramUserId || null,
  };

  if (existing?.length) {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .update(payload)
      .eq("role", selectedRole);

    if (error) throw new Error(error.message || "Failed to update role contact");
  } else {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .insert({
        role: selectedRole,
        ...payload,
        active: selectedRole === "admin",
      });

    if (error) throw new Error(error.message || "Failed to create role contact");
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "role-management",
    severity: "success",
    message: `Update OTP and Telegram contact for ${selectedRole}`,
    metadata: {
      access_role: "admin",
      target_role: selectedRole,
      active: existing?.[0]?.active ?? selectedRole === "admin",
      has_phone: Boolean(cleanPhone),
      has_telegram_user_id: Boolean(cleanTelegramUserId),
    },
  });

  return { ok: true };
}

// Backward-compatible wrapper for any older caller that only updates Telegram.
export async function updateRoleTelegramContact({ req, role, telegramUserId }) {
  const selectedRole = assertRole(role);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("phone")
    .eq("role", selectedRole)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to read role contact");

  return updateRoleContactChannels({
    req,
    role: selectedRole,
    phone: data?.phone || "",
    telegramUserId,
  });
}
