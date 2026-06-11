import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";
import {
  getRoleManagementOverview,
  revokeManagedSession,
  revokeRoleSessions,
  setRoleLoginStatus,
  updateRoleContact,
} from "@/features/roleManagement/roleManagementService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdminPin(req, pin) {
  const pinLimit = await enforceFailureRateLimit(
    req,
    RATE_LIMIT_SCOPES.settingsPinFailed,
    { identity: "session" },
  );

  if (pinLimit) return pinLimit;

  if (pin !== process.env.ADMIN_PIN) {
    await recordRateLimitFailure(
      req,
      RATE_LIMIT_SCOPES.settingsPinFailed,
      { identity: "session" },
    );

    return NextResponse.json({ error: "PIN tidak valid" }, { status: 403 });
  }

  await clearRateLimit(
    req,
    RATE_LIMIT_SCOPES.settingsPinFailed,
    { identity: "session" },
  );

  return null;
}

async function runAction(req, body) {
  const action = String(body?.action || "").trim();

  if (action === "update_contact") {
    return updateRoleContact({
      req,
      role: body.role,
      phone: body.phone,
      active: body.active,
    });
  }

  if (action === "set_role_login") {
    return setRoleLoginStatus({
      req,
      role: body.role,
      active: body.active,
    });
  }

  if (action === "revoke_session") {
    return revokeManagedSession({ req, id: body.id });
  }

  if (action === "revoke_role_sessions") {
    return revokeRoleSessions({ req, role: body.role });
  }

  throw new Error("Action role management tidak valid");
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const result = await getRoleManagementOverview(req);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal membaca role management" },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const actionLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsUpdate,
      { identity: "session" },
    );

    if (actionLimit) return actionLimit;

    const body = await req.json();
    const pinError = await assertAdminPin(req, body?.pin);
    if (pinError) return pinError;

    const result = await runAction(req, body);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal menjalankan action role management" },
      { status: 500 },
    );
  }
}
