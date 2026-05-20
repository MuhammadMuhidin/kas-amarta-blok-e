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

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!isAdmin(req)) {
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
    if (!isAdmin(req)) {
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

    await updateAppConfig(key, value);

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