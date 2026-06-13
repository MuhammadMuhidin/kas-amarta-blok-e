import {
  updateAdminRolePassword,
  updateAdminRolePin,
  validateNewRolePassword,
  validateNewRolePin,
} from "@/lib/adminRoleCredentials";
import { getAdminSessions, revokeAdminSession } from "@/lib/adminSession";
import { assertAdminAccessRole, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import { recordAdminActivity } from "@/lib/adminActivity";

async function revokeOtherSessions(req, session) {
  const sessions = await getAdminSessions(req);
  const targets = sessions.filter(
    (item) => item.access_role === session.access_role && String(item.id) !== String(session.id),
  );

  for (const target of targets) {
    await revokeAdminSession(target.id);
  }

  return targets.length;
}

export async function changeOwnCredential({ req, session, type, value, confirmation }) {
  const role = assertAdminAccessRole(session?.access_role);
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

  const revokedSessions = await revokeOtherSessions(req, session);

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
        revoked_sessions: revokedSessions,
      },
    });
  } catch (error) {
    console.error("Profile credential activity log failed:", error.message);
  }

  return {
    ok: true,
    message: type === "password" ? "Password berhasil diperbarui" : "PIN berhasil diperbarui",
  };
}
