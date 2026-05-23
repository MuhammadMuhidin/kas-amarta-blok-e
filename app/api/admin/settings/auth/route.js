import { NextResponse } from "next/server";
import { getAuthConfigs, updateAuthConfig } from "@/lib/webauth";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/adminActivity";

export const runtime = "nodejs";

const allowedDurations = new Set([
  "3600",
  "21600",
  "43200",
  "86400",
  "259200",
  "604800",
  "2592000",
]);

function normalizeAuthValue(key, value) {
  if (key === "SESSION_DURATION") {
    const normalized = String(value || "");

    if (!allowedDurations.has(normalized)) {
      throw new Error("Session duration tidak valid");
    }

    return normalized;
  }

  if (!["WEB_AUTH_ENABLED", "PIN_ENABLED"].includes(key)) {
    throw new Error("Config key tidak diizinkan");
  }

  return value ? "true" : "false";
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const config = await getAuthConfigs();

    return NextResponse.json({
      ok: true,
      config,
    });
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
    if (!(await isAdmin(req))) {
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

    const { key, value, pin } = await req.json();

    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json(
        {
          error: "PIN tidak valid",
        },
        {
          status: 403,
        },
      );
    }

    const normalizedValue = normalizeAuthValue(key, value);

    await updateAuthConfig(key, normalizedValue);

    await recordAdminActivity(req, {
      type: "update",
      module: "settings-auth",
      severity: "success",
      message: `Update auth setting ${key}`,
      metadata: {
        key,
        value: normalizedValue,
      },
    });

    return NextResponse.json({
      ok: true,
    });
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
