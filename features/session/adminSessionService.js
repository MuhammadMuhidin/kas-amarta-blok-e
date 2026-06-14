import {
  getAdminSessions,
  revokeAdminSession,
} from "@/lib/adminSession";
import { recordAdminActivity } from "@/lib/adminActivity";

export async function listAdminSessions(req) {
  const sessions = await getAdminSessions(req);

  return {
    ok: true,
    sessions,
  };
}

export async function disconnectAdminSession({ req, id }) {
  const sessions = await getAdminSessions(req);
  const targetSession = sessions.find(
    (session) => String(session.id) === String(id),
  );

  await revokeAdminSession(id);

  await recordAdminActivity(req, {
    type: "revoke",
    module: "session",
    severity: "warning",
    message: `Revoke admin session ${id}`,
    metadata: {
      session_id: id,
      access_role: targetSession?.access_role || null,
      device_name: targetSession?.device_name || null,
      ip: targetSession?.ip || null,
      location: targetSession?.location || null,
      last_active: targetSession?.last_active || null,
      current: Boolean(targetSession?.current),
    },
  });

  return { ok: true };
}
