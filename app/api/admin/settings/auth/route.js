import { NextResponse } from "next/server";
import { getAuthConfigs, updateAuthConfig } from "@/lib/webauth";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!isAdmin(req)) {
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
