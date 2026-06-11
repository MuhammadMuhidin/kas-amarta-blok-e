import { getAuthConfigs, getActiveCredentials } from "@/lib/webauth";
import { getAdminSessions } from "@/lib/adminSession";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { ADMIN_MODULES } from "@/lib/adminModules";
import { getAllowedAdminModules } from "@/lib/adminAccessMatrix";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ROLE_CONTACTS_TABLE = dbTable("role_contacts");
const ADMIN_LOGIN_OTPS_TABLE = dbTable("admin_login_otps");
const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

const ROLE_VALUES = ADMIN_ACCESS_ROLES.map((role) => role.value);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function findRole(value) {
  const role = normalize(value);
  return ROLE_VALUES.includes(role) ? role : "";
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
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
      .limit(20);

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
      status: latest?.status || "none",
      attempt_count: safeNumber(latest?.attempt_count),
      max_attempts: 5,
      expires_at: latest?.expires_at || "",
      used_at: latest?.used_at || "",
      created_at: latest?.created_at || "",
    };
  });
}

function buildSecurityHealth({ contacts, sessions, otpMonitor, authHealth }) {
  const missingContacts = contacts.filter((contact) => !contact.phone || !contact.active);
  const pendingOtp = otpMonitor.filter((otp) => ["pending", "sent"].includes(otp.status));
  const expiredOtp = otpMonitor.filter((otp) => otp.status === "expired");
  const failedOtp = otpMonitor.filter((otp) => otp.status === "failed" || otp.attempt_count >= otp.max_attempts);
  const warnings = [
    ...missingContacts.map((contact) => `${contact.label} belum punya kontak OTP aktif`),
    ...pendingOtp.map((otp) => `${otp.label} masih punya OTP ${otp.status}`),
    ...expiredOtp.map((otp) => `${otp.label} punya OTP expired terakhir`),
    ...failedOtp.map((otp) => `${otp.label} punya OTP gagal/terkunci`),
  ];

  if (!authHealth.pin_enabled) warnings.push("PIN login global belum aktif");
  if (!authHealth.web_auth_enabled) warnings.push("Passkey global belum aktif");
  if (authHealth.passkey_count < 1) warnings.push("Belum ada passkey aktif");

  return {
    overall_status: warnings.length ? "Attention" : "Strong",
    contact_ready_count: contacts.filter((contact) => contact.phone && contact.active).length,
    contact_total: contacts.length,
    active_session_count: sessions.length,
    pending_otp_count: pendingOtp.length,
    expired_otp_count: expiredOtp.length,
    failed_otp_count: failedOtp.length,
    web_auth_enabled: authHealth.web_auth_enabled,
    pin_enabled: authHealth.pin_enabled,
    passkey_count: authHealth.passkey_count,
    session_duration: authHealth.session_duration,
    warnings: warnings.slice(0, 8),
  };
}

function buildDangerZone({ sessions, otpMonitor }) {
  const nonCurrentSessions = sessions.filter((session) => !session.current);
  const pendingOtp = otpMonitor.filter((otp) => ["pending", "sent"].includes(otp.status));

  return [
    {
      key: "revoke_sessions",
      label: "Revoke non-current sessions",
      count: nonCurrentSessions.length,
      status: nonCurrentSessions.length ? "Available from Active Role Sessions" : "No extra active session",
      description: "Gunakan kontrol revoke session existing agar tidak menambah destructive flow baru.",
    },
    {
      key: "expire_otp",
      label: "Expire pending OTP",
      count: pendingOtp.length,
      status: pendingOtp.length ? "Manual review" : "No pending OTP",
      description: "OTP pending masih dipantau read-only di patch ini.",
    },
    {
      key: "disable_role_login",
      label: "Disable role login",
      count: 0,
      status: "Not implemented",
      description: "Butuh kolom status role/contact sebelum aman dijadikan aksi.",
    },
  ];
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
      role_overview: buildRoleOverview({
        contacts: contactsRaw,
        sessions,
        activities,
        accessSummary,
      }),
      role_contacts: contacts,
      active_sessions: sessions,
      role_access_summary: accessSummary,
      role_activity_log: activities,
      otp_login_monitor: otpMonitor,
      security_health: buildSecurityHealth({
        contacts,
        sessions,
        otpMonitor,
        authHealth,
      }),
      danger_zone: buildDangerZone({
        sessions,
        otpMonitor,
      }),
    },
  };
}
