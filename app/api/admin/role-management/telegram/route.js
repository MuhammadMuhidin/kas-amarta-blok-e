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
  getRoleTelegramContacts,
  updateRoleTelegramContact,
} from "@/features/roleManagement/telegramRoleContactService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdministrator(req))) return unauthorized();
    return NextResponse.json({ ok: true, contacts: await getRoleTelegramContacts() });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to read Telegram role contacts" },
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

    const pinLimit = await enforceFailureRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsPinFailed,
      { identity: "session" },
    );
    if (pinLimit) return pinLimit;

    const body = await req.json().catch(() => ({}));
    if (!(await verifyAdminRolePin("admin", body.pin))) {
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

    const result = await updateRoleTelegramContact({
      req,
      role: body.role,
      telegramUserId: body.telegram_user_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update Telegram role contact" },
      { status: 500 },
    );
  }
}
