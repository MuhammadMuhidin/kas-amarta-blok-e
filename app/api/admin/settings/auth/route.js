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
  getAuthSettings,
  updateAuthSetting,
} from "@/features/settings/authSettingsService";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdministrator(req))) {
      return unauthorized();
    }

    const result = await getAuthSettings();

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Gagal membaca settings",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdministrator(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json(
        {
          error: "CSRF tidak valid",
        },
        {
          status: 403,
        },
      );
    }

    const settingsLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsUpdate,
      { identity: "session" },
    );

    if (settingsLimit) return settingsLimit;

    const { key, value, pin } = await req.json();

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

      return NextResponse.json(
        {
          error: "PIN tidak valid",
        },
        {
          status: 403,
        },
      );
    }

    await clearRateLimit(
      req,
      RATE_LIMIT_SCOPES.settingsPinFailed,
      { identity: "session" },
    );

    const result = await updateAuthSetting({ req, key, value });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Gagal update settings",
      },
      {
        status: 500,
      },
    );
  }
}
