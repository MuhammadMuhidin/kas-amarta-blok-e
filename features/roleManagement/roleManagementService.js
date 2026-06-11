import { getAuthConfigs, getActiveCredentials } from "@/lib/webauth";
import { getAdminSessions, revokeAdminSession } from "@/lib/adminSession";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { ADMIN_MODULES } from "@/lib/adminModules";
import { getAllowedAdminModules } from "@/lib/adminAccessMatrix";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAdminActivity } from "@/lib/adminActivity";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");
const ADMIN_LOGIN_OTPS_TABLE = dbTable("admin_login_otps");
const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

const ROLE_VALUES = ADMIN_ACCESS_ROLES.map((role) => role.value);
const MAX_OTP_ATTEMPTS = 5;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value || "").trim();
}

function findRole(value) {
  const role = normalize(value);
  return ROLE_VALUES.includes(role) ? role : "";
}

function assertRole(value) {
  const role = findRole(value);
  if (!role) throw new Error("Invalid role");
  return role;
}

function assertNonAdminRole(value) {
  const role = assertRole(value);
  if (role === "admin") throw new Error("Administrator login cannot be disabled from Role Management");
  return role;
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isPastDate(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) && Date.now() >= time;
}

function getEffectiveOtpStatus(row) {
  const status = normalize(row?.status || "none");
  if (["pending", "sent"].includes(status) && isPastDate(row?.expires_at)) return "expired";
  return status || "none";
}

function emptyRoleMap() {
  return Object.fromEntries(ROLE_VALUES.map((role) => [role, []]));
}

function groupByRole(rows = [], getRole) {
  const grouped = emptyRoleMap();
  for (const row of rows || []) {
    const role = findRole(getRole(row));
    if (role) grouped[role].push(row);
  }
  return grouped;
}

function getLatest(rows = [], field = "created_at") {
  return [...(rows || [])]
    .filter((row) => row?.[field])
    .sort((a, b) => new Date(b[field]).getTime() - new Date(a[field]).getTime())[0] || null;
}

function inferActivityRole(activity) {
  const metadataRole = findRole(activity?.metadata?.access_role || activity?.metadata?.role);
  if (metadataRole) return metadataRole;

  const text = normalize(`${activity?.actor || ""} ${activity?.message || ""}`);
  return ROLE_VALUES.find((role) => text.includes(role)) || "";
}

async function safeQuery(callback, fallback) {
  try {
    return await callback();
  } catch {
    return fallback;
  }
}

async function readRoleContacts(supabase) {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .select("*")
      .in("role", ROLE_VALUES);

    if (error) throw error;
    return data || [];
  }, []);
}

async function readOtpLogs(supabase) {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from(ADMIN_LOGIN_OTPS_TABLE)
      .select("id,role,status,attempt_count,expires_at,used_at,created_at")
      .in("role", ROLE_VALUES)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw error;
    return data || [];
  }, []);
}

async function readActivities(supabase) {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from(ADMIN_ACTIVITIES_TABLE)
      .select("id,type,module,severity,message,metadata,actor,device_name,ip,location,created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) throw error;
    return data || [];
  }, []);
}

async function readAuthHealth() {
  return safeQuery(async () => {
    const [config, credentials] = await Promise.all([
      getAuthConfigs(),
      getActiveCredentials(),
    ]);

    return {
      web_auth_enabled: Boolean(config.webAuthEnabled),
      pin_enabled: Boolean(config.pinEnabled),
      session_duration: safeNumber(config.sessionDuration),
      passkey_count: credentials.length,
    };
  }, {
    web_auth_enabled: false,
    pin_enabled: false,
    session_duration: 0,
    passkey_count: 0,
  });
}

async function buildRoleAccessSummary() {
  return Promise.all(
    ADMIN_ACCESS_ROLES.map(async (role) => {
      const allowedKeys = await getAllowedAdminModules(role.value);
      const allowedSet = new Set(allowedKeys || []);
      const modules = ADMIN_MODULES.map((module) => ({
        key: module.key,
        label: module.label,
        visible: allowedSet.has(module.key),
        locked:
          role.value === "admin" ||
          module.key === "overview" ||
          module.key === "settings" ||
          module.key === "role_management",
      }));

      return {
        role: role.value,
        label: role.label,
        allowed_count: modules.filter((module) => module.visible).length,
        total_count: modules.length,
        modules,
      };
    }),
  );
}

function buildRoleOverview({ contacts, sessions, activities, accessSummary }) {
  const contactsByRole = new Map(contacts.map((contact) => [findRole(contact.role), contact]));
  const sessionsByRole = groupByRole(sessions, (session) => session.access_role);
  const activitiesByRole = groupByRole(activities, inferActivityRole);
  const accessByRole = new Map(accessSummary.map((item) => [item.role, item]));

  return ADMIN_ACCESS_ROLES.map((role) => {
    const contact = contactsByRole.get(role.value) || null;
    const roleSessions = sessionsByRole[role.value] || [];
    const latestSession = getLatest(roleSessions, "created_at");
    const latestActivity = getLatest(activitiesByRole[role.value] || [], "created_at");
    const access = accessByRole.get(role.value);

    return {
      role: role.value,
      label: role.label,
      status: contact?.active === false ? "Contact inactive" : "Active",
      contact_active: contact ? contact.active !== false : false,
      menu_count: access?.allowed_count || 0,
      menu_total: access?.total_count || ADMIN_MODULES.length,
      active_sessions: roleSessions.length,
      last_login_at: latestSession?.created_at || "",
      last_activity_at: latestActivity?.created_at || "",
    };
  });
}

function buildRoleContacts(contacts) {
  const contactsByRole = new Map(contacts.map((contact) => [findRole(contact.role), contact]));

  return ADMIN_ACCESS_ROLES.map((role) => {
    const contact = contactsByRole.get(role.value) || {};
    return {
      role: role.value,
      label: role.label,
      display_name: contact.display_name || contact.name || role.label,
      phone: contact.phone || "",
      active: contact.active === true,
      updated_at: contact.updated_at || "",
      can_disable: role.value !== "admin",
    };
  });
}

function buildOtpMonitor(otpLogs) {
  const otpByRole = groupByRole(otpLogs, (row) => row.role);

  return ADMIN_ACCESS_ROLES.map((role) => {
    const latest = otpByRole[role.value]?.[0] || null;
    return {
      role: role.value,
      label: role.label,
      status: getEffectiveOtpStatus(latest),
      raw_status: latest?.status || "none",
      attempt_count: safeNumber(latest?.attempt_count),
      max_attempts: MAX_OTP_ATTEMPTS,
      expires_at: latest?.expires_at || "",
      used_at: latest?.used_at || "",
      created_at: latest?.created_at || "",
    };
  });
}

function buildSecurityHealth({ contacts, sessions, otpMonitor, authHealth }) {
  const missingContacts = contacts.filter((contact) => !contact.phone || !contact.active);
  const failedOtp = otpMonitor.filter((otp) => otp.status === "failed" || otp.attempt_count >= otp.max_attempts);
  const warnings = [
    ...missingContacts.map((contact) => `${contact.label} does not have an active OTP contact`),
    ...failedOtp.map((otp) => `${otp.label} has failed or locked OTP attempts`),
  ];

  if (!authHealth.pin_enabled) warnings.push("Global PIN login is disabled");
  if (!authHealth.web_auth_enabled) warnings.push("Global passkey login is disabled");
  if (authHealth.passkey_count < 1) warnings.push("No active passkey is registered");

  return {
    overall_status: warnings.length ? "Attention" : "Strong",
    contact_ready_count: contacts.filter((contact) => contact.phone && contact.active).length,
    contact_total: contacts.length,
    active_session_count: sessions.length,
    failed_otp_count: failedOtp.length,
    web_auth_enabled: authHealth.web_auth_enabled,
    pin_enabled: authHealth.pin_enabled,
    passkey_count: authHealth.passkey_count,
    session_duration: authHealth.session_duration,
    warnings: warnings.slice(0, 8),
  };
}

export async function getRoleManagementOverview(req) {
  const supabase = getSupabaseAdmin();
  const [contactsRaw, sessions, otpLogs, activities, authHealth, accessSummary] = await Promise.all([
    readRoleContacts(supabase),
    getAdminSessions(req),
    readOtpLogs(supabase),
    readActivities(supabase),
    readAuthHealth(),
    buildRoleAccessSummary(),
  ]);

  const contacts = buildRoleContacts(contactsRaw);
  const otpMonitor = buildOtpMonitor(otpLogs);

  return {
    ok: true,
    roles: ADMIN_ACCESS_ROLES,
    cards: {
      role_overview: buildRoleOverview({ contacts: contactsRaw, sessions, activities, accessSummary }),
      role_contacts: contacts,
      active_sessions: sessions,
      role_access_summary: accessSummary,
      role_activity_log: activities,
      otp_login_monitor: otpMonitor,
      security_health: buildSecurityHealth({ contacts, sessions, otpMonitor, authHealth }),
    },
  };
}

export async function updateRoleContact({ req, role, phone, active }) {
  const selectedRole = assertRole(role);
  const cleanPhone = clean(phone);
  const nextActive = selectedRole === "admin" ? true : Boolean(active);
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role")
    .eq("role", selectedRole)
    .limit(1);

  if (readError) throw new Error(readError.message || "Failed to read role contact");

  if (existing?.length) {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .update({ phone: cleanPhone, active: nextActive })
      .eq("role", selectedRole);
    if (error) throw new Error(error.message || "Failed to update role contact");
  } else {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .insert({ role: selectedRole, phone: cleanPhone, active: nextActive });
    if (error) throw new Error(error.message || "Failed to create role contact");
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "role-management",
    severity: "success",
    message: `Update OTP receiver for ${selectedRole}`,
    metadata: { access_role: "admin", target_role: selectedRole, active: nextActive, has_phone: Boolean(cleanPhone) },
  });

  return { ok: true };
}

export async function setRoleLoginStatus({ req, role, active }) {
  const selectedRole = Boolean(active) ? assertRole(role) : assertNonAdminRole(role);
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from(ROLE_CONTACTS_TABLE)
    .select("role,phone")
    .eq("role", selectedRole)
    .limit(1);

  if (readError) throw new Error(readError.message || "Failed to read role login status");

  if (existing?.length) {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .update({ active: Boolean(active) })
      .eq("role", selectedRole);
    if (error) throw new Error(error.message || "Failed to update role login status");
  } else {
    const { error } = await supabase
      .from(ROLE_CONTACTS_TABLE)
      .insert({ role: selectedRole, phone: "", active: Boolean(active) });
    if (error) throw new Error(error.message || "Failed to create role login status");
  }

  await recordAdminActivity(req, {
    type: Boolean(active) ? "enable" : "disable",
    module: "role-management",
    severity: Boolean(active) ? "success" : "warning",
    message: `${Boolean(active) ? "Enable" : "Disable"} role login ${selectedRole}`,
    metadata: { access_role: "admin", target_role: selectedRole, active: Boolean(active) },
  });

  return { ok: true };
}

export async function revokeManagedSession({ req, id }) {
  const sessions = await getAdminSessions(req);
  const targetSession = sessions.find((session) => String(session.id) === String(id));

  if (!targetSession) throw new Error("Session not found");
  if (targetSession.current) throw new Error("The current session cannot be revoked from Role Management");

  await revokeAdminSession(id);
  await recordAdminActivity(req, {
    type: "revoke",
    module: "role-management",
    severity: "warning",
    message: `Revoke role session ${id}`,
    metadata: {
      access_role: "admin",
      target_role: targetSession.access_role || null,
      session_id: id,
      device_name: targetSession.device_name || null,
      ip: targetSession.ip || null,
      location: targetSession.location || null,
    },
  });

  return { ok: true };
}

export async function revokeRoleSessions({ req, role }) {
  const selectedRole = assertRole(role);
  const sessions = await getAdminSessions(req);
  const targets = sessions.filter((session) => session.access_role === selectedRole && !session.current);

  for (const session of targets) await revokeAdminSession(session.id);

  await recordAdminActivity(req, {
    type: "revoke",
    module: "role-management",
    severity: "warning",
    message: `Revoke all sessions for ${selectedRole}`,
    metadata: { access_role: "admin", target_role: selectedRole, affected: targets.length },
  });

  return { ok: true, affected: targets.length };
}
