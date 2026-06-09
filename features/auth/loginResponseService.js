import { NextResponse } from "next/server";
import {
  createCSRFToken,
  getAdminSessionDuration,
} from "@/lib/webauth";
import {
  createAdminSession,
  getSessionCookieName,
} from "@/lib/adminSession";

export async function createAuthResponse(req, { clearWebAuthChallenge = false } = {}) {
  const csrfToken = createCSRFToken();
  const sessionDuration = await getAdminSessionDuration();

  const res = NextResponse.json({
    ok: true,
  });

  const token = await createAdminSession(req, sessionDuration);

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
