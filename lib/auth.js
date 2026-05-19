import { NextResponse } from "next/server";

export function isAdmin(req) {
  return req.cookies.get("admin")?.value === "true";
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
