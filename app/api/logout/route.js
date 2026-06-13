import { NextResponse } from "next/server";

import { validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession, getSessionCookieName, revokeAdminSession } from "@/lib/adminSession";

export async function POST(req) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
  }

  const session = await getCurrentAdminSession(req);
  if (session?.id) await revokeAdminSession(session.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(getSessionCookieName());
  res.cookies.delete("csrf_token");
  res.cookies.delete("admin");
  return res;
}
