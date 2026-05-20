import { NextResponse } from "next/server";

import {
  validateAdminSession,
} from "@/lib/adminSession";

export async function isAdmin(req) {
  return validateAdminSession(req);
}

export function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized",
    },
    {
      status: 401,
    },
  );
}

export function validateCSRF(req) {
  const cookieToken = req.cookies.get("csrf_token")?.value;

  const headerToken = req.headers.get("x-csrf-token");

  return cookieToken && headerToken && cookieToken === headerToken;
}
