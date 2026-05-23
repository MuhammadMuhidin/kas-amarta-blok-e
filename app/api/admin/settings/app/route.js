import { NextResponse } from "next/server";
import {
  isAdmin,
  unauthorized,
  validateCSRF,
} from "@/lib/auth";
import {
  getAppConfig,
  updateAppConfig,
} from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const config = await getAppConfig();

    return NextResponse.json({
      ok: true,
      config,
    });
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

    const currentConfig = await getAppConfig();
    const oldValue = currentConfig?.[key];

    await updateAppConfig(key, value);

    const updatedConfig = await getAppConfig();
    const newValue = updatedConfig?.[key];

    await recordAdminActivity(req, {
      type: "update",
      module: "settings-app",
      severity: "success",
      message: `Update app config ${key}`,
      metadata: {
        key,
        old_value: oldValue,
        new_value: newValue,
      },
    });

    return NextResponse.json({
      ok: true,
    });
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