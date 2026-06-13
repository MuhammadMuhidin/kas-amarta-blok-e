import { NextResponse } from "next/server";

import {
  isAdministrator,
  unauthorized,
  validateCSRF,
} from "@/lib/auth";

import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";
import {
  disconnectAdminSession,
  listAdminSessions,
} from "@/features/session/adminSessionService";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdministrator(req))) {
      return unauthorized();
    }

    const result = await listAdminSessions(req);

    return NextResponse.json(result);
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

    const revokeLimit = await enforceRateLimit(
      req,
      RATE_LIMIT_SCOPES.sessionRevoke,
      { identity: "session" },
    );

    if (revokeLimit) return revokeLimit;

    const { id } = await req.json();
    const result = await disconnectAdminSession({ req, id });

    return NextResponse.json(result);
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
