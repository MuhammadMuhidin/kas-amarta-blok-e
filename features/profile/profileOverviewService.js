import { getAdminRoleCredentialStatus } from "@/lib/adminRoleCredentials";
import { getAdminSessions } from "@/lib/adminSession";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

function cleanSession(session) {
  return {
    id: session.id,
    device_name: session.device_name || "Perangkat tidak dikenal",
    location: session.location || null,
    created_at: session.created_at || null,
    last_active: session.last_active || null,
    expires_at: session.expires_at || null,
    current: Boolean(session.current),
  };
}

async function getRoleSecurityActivities(role) {
  const { data, error } = await getSupabaseAdmin()
    .from(ADMIN_ACTIVITIES_TABLE)
    .select("id,type,module,severity,message,metadata,device_name,location,created_at")
    .in("module", ["profile", "session"])
    .contains("metadata", { access_role: role })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message || "Gagal membaca aktivitas keamanan");
  return data || [];
}

export async function getProfileOverview(req, session) {
  const role = session.access_role;
  const [allSessions, credentialStatus, roleActivities] = await Promise.all([
    getAdminSessions(req),
    getAdminRoleCredentialStatus(role),
    getRoleSecurityActivities(role),
  ]);

  const sessions = allSessions
    .filter((item) => item.access_role === role)
    .map(cleanSession);
  const currentSession = sessions.find((item) => String(item.id) === String(session.id)) || null;

  const passwordActivity = roleActivities.find(
    (item) => item.module === "profile" && item?.metadata?.credential_type === "password",
  );
  const pinActivity = roleActivities.find(
    (item) => item.module === "profile" && item?.metadata?.credential_type === "pin",
  );

  return {
    ok: true,
    role,
    credentials: {
      password: {
        active: credentialStatus.password_configured,
        updated_at: passwordActivity?.created_at || null,
      },
      pin: {
        active: credentialStatus.pin_configured,
        updated_at: pinActivity?.created_at || null,
      },
    },
    current_session: currentSession,
    sessions,
    session_count: sessions.length,
    activities: roleActivities.slice(0, 3).map((item) => ({
      id: item.id,
      type: item.type,
      module: item.module,
      severity: item.severity,
      message: item.message,
      credential_type: item?.metadata?.credential_type || null,
      device_name: item.device_name || item?.metadata?.device_name || null,
      location: item.location || item?.metadata?.location || null,
      created_at: item.created_at,
    })),
  };
}
