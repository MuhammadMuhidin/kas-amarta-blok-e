import { NextResponse } from "next/server";
import { getAuthConfigs, updateAuthConfig } from "@/lib/webauth";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/adminActivity";

export const runtime = "nodejs";

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

    await updateAuthConfig(key, value ? "true" : "false");

    await recordAdminActivity(req, {
      type: "update",
      module: "settings-auth",
      severity: "success",
      message: `Update auth setting ${key}`,
      metadata: {
        key,
        value: Boolean(value),
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
