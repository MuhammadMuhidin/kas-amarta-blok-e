import { NextResponse } from "next/server";
import {
  createCSRFToken,
  getAdminSessionDuration,
} from "@/lib/webauth";
import {
  createAdminSession,
  getSessionCookieName,
} from "@/lib/adminSession";
import { resolveAdminAccessRole } from "@/lib/adminRoles";

export async function createAuthResponse(req, { clearWebAuthChallenge = false, accessRole } = {}) {
  const csrfToken = createCSRFToken();
  const sessionDuration = await getAdminSessionDuration();
  const resolvedAccessRole = resolveAdminAccessRole(accessRole);

  const res = NextResponse.json({
    ok: true,
    access_role: resolvedAccessRole,
  });

  const token = await createAdminSession(req, sessionDuration, {
    accessRole: resolvedAccessRole,
  });

  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: sessionDuration,
  });

  res.cookies.set("csrf_token", csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: sessionDuration,
  });

  if (clearWebAuthChallenge) {
    res.cookies.delete("webauth_login_challenge");
  }

  return res;
}
