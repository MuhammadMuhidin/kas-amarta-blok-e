import {
  updateAdminRolePassword,
  updateAdminRolePin,
  validateNewRolePassword,
  validateNewRolePin,
} from "@/lib/adminRoleCredentials";
import { getAdminSessions, revokeAdminSession } from "@/lib/adminSession";
import { assertAdminAccessRole, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import { recordAdminActivity } from "@/lib/adminActivity";

async function getRoleSessionIds(req, session) {
  const sessions = await getAdminSessions(req);
  const targetIds = new Set(
    sessions
      .filter((item) => item.access_role === session.access_role)
      .map((item) => String(item.id)),
  );

  if (session.id) targetIds.add(String(session.id));
  return Array.from(targetIds);
}

async function revokeRoleSessions(sessionIds) {
  await Promise.all(sessionIds.map((sessionId) => revokeAdminSession(sessionId)));
  return sessionIds.length;
}

export async function changeOwnCredential({ req, session, type, value, confirmation }) {
  const role = assertAdminAccessRole(session?.access_role);
  const roleSessionIds = await getRoleSessionIds(req, session);
  let result;

  if (type === "password") {
    result = await updateAdminRolePassword({
      role,
      value: validateNewRolePassword(value, confirmation, role),
      updatedBy: session.id,
    });
  } else if (type === "pin") {
    result = await updateAdminRolePin({
      role,
      value: validateNewRolePin(value, confirmation),
      updatedBy: session.id,
    });
  } else {
    throw new Error("Jenis credential tidak valid");
  }

  try {
    await recordAdminActivity(req, {
      type: "security-update",
      module: "profile",
      severity: "success",
      message: `${getAdminAccessRoleLabel(role)} memperbarui ${type === "password" ? "password" : "PIN"} miliknya`,
      metadata: {
        access_role: role,
        credential_type: type,
        credential_version: result.credential_version,
        revoked_sessions: roleSessionIds.length,
      },
    });
  } catch (error) {
    console.error("Profile credential activity log failed:", error.message);
  }

  const revokedSessions = await revokeRoleSessions(roleSessionIds);

  return {
    ok: true,
    message: type === "password" ? "Password berhasil diperbarui" : "PIN berhasil diperbarui",
    revoked_sessions: revokedSessions,
  };
}
