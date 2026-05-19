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

    const { key, value } = await req.json();

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