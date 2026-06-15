import { NextResponse } from "next/server";
import {
  getIntegrationSettings,
  resetIntegrationSetting,
  updateIntegrationSetting,
} from "@/features/settings/integrationSettingsService";
import { verifyAdminRolePin } from "@/lib/adminRoleCredentials";
import {
  isAdmin,
  isAdministrator,
  unauthorized,
  validateCSRF,
} from "@/lib/auth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    return NextResponse.json(await getIntegrationSettings());
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal membaca Integration Configuration" },
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

    const settingsLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsUpdate,
      { identity: "session" },
    );
    if (settingsLimit) return settingsLimit;

    const body = await req.json().catch(() => ({}));
    const pinLimit = await enforceFailureRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsPinFailed,
      { identity: "session" },
    );
    if (pinLimit) return pinLimit;

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

    const action = String(body.action || "save").trim().toLowerCase();
    const result = action === "reset"
      ? await resetIntegrationSetting({ req, key: body.key })
      : await updateIntegrationSetting({ req, key: body.key, value: body.value });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan Integration Configuration" },
      { status: 500 },
    );
  }
}
