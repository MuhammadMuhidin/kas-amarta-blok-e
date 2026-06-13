import { NextResponse } from "next/server";

import {
  getCurrentAdminSession,
  validateAdminSession,
} from "@/lib/adminSession";

export async function isAdmin(req) {
  return validateAdminSession(req);
}

export async function isAdministrator(req) {
  const session = await getCurrentAdminSession(req);
  return session?.access_role === "admin";
}

export function unauthorized() {
  const res = NextResponse.json(
    {
      error: "Unauthorized",
    },
    {
      status: 401,
    },
  );

  res.cookies.set("admin_session", "", {
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("csrf_token", "", {
    path: "/",
    maxAge: 0,
  });

  return res;
}

export function validateCSRF(req) {
  const cookieToken = req.cookies.get("csrf_token")?.value;

  const headerToken = req.headers.get("x-csrf-token");

  return cookieToken && headerToken && cookieToken === headerToken;
}
