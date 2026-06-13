import { NextResponse } from "next/server";
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
import {
  getAppSettings,
  updateAppSetting,
} from "@/features/settings/appSettingsService";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const result = await getAppSettings();

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Gagal membaca konfigurasi kas",
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

    const result = await updateAppSetting({ req, key, value });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Gagal menyimpan konfigurasi kas",
      },
      {
        status: 500,
      },
    );
  }
}
