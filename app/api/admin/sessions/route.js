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

import { recordAdminActivity } from "@/lib/adminActivity";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const sessions =
      await getAdminSessions(req);

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

    const revokeLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.sessionRevoke,
      { identity: "session" },
    );

    if (revokeLimit) return revokeLimit;

    const { id } = await req.json();
    const sessions = await getAdminSessions(req);
    const targetSession = sessions.find(
      (session) => String(session.id) === String(id),
    );

    await revokeAdminSession(id);

    await recordAdminActivity(req, {
      type: "revoke",
      module: "session",
      severity: "warning",
      message: `Revoke admin session ${id}`,
      metadata: {
        session_id: id,
        device_name: targetSession?.device_name || null,
        ip: targetSession?.ip || null,
        location: targetSession?.location || null,
        last_active: targetSession?.last_active || null,
        current: Boolean(targetSession?.current),
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
          "Gagal memutuskan session",
      },
      {
        status: 500,
      },
    );
  }
}
