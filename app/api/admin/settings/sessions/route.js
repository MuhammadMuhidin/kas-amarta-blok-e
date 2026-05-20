import { NextResponse } from "next/server";

import {
  isAdmin,
  unauthorized,
  validateCSRF,
} from "@/lib/auth";

import {
  getAdminSessions,
  revokeAdminSession,
} from "@/lib/adminSession";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const sessions =
      await getAdminSessions();

    return NextResponse.json({
      ok: true,
      sessions,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Gagal mengambil session",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(req) {
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

    const { id } = await req.json();

    await revokeAdminSession(id);

    return NextResponse.json({
      ok: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Gagal memutuskan session",
      },
      {
        status: 500,
      },
    );
  }
}