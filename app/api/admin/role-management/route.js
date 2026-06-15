import { NextResponse } from "next/server";
import { verifyAdminRolePin } from "@/lib/adminRoleCredentials";
import { isAdministrator, unauthorized, validateCSRF } from "@/lib/auth";
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
} from "@/features/roleManagement/roleManagementService";
import {
  enrichRoleContactsWithTelegram,
  updateRoleContactChannels,
} from "@/features/roleManagement/telegramRoleContactService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PINLESS_ACTIONS = new Set(["revoke_session", "revoke_role_sessions"]);

async function assertAdminPin(req, pin) {
  const pinLimit = await enforceFailureRateLimit(
    req,
    RATE_LIMIT_SCOPES.settingsPinFailed,
    { identity: "session" },
  );

  if (pinLimit) return pinLimit;

  if (!(await verifyAdminRolePin("admin", pin))) {
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

function getAction(body) {
  return String(body?.action || "").trim();
}

async function runAction(req, body) {
  const action = getAction(body);

  if (action === "update_contact") {
    return updateRoleContactChannels({
      req,
      role: body.role,
      phone: body.phone,
      telegramUserId: body.telegram_user_id,
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
    if (!(await isAdministrator(req))) return unauthorized();

    const result = await getRoleManagementOverview(req);
    result.cards.role_contacts = await enrichRoleContactsWithTelegram(
      result.cards.role_contacts || [],
    );

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
    if (!(await isAdministrator(req))) return unauthorized();

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
    const action = getAction(body);

    if (!PINLESS_ACTIONS.has(action)) {
      const pinError = await assertAdminPin(req, body?.pin);
      if (pinError) return pinError;
    }

    const result = await runAction(req, body);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal menjalankan action role management" },
      { status: 500 },
    );
  }
}
