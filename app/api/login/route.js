import crypto from "crypto";
import { NextResponse } from "next/server";

function createAuthResponse() {
  const csrfToken =
    crypto.randomBytes(32).toString("hex");

  const res = NextResponse.json({
    ok: true,
  });

  res.cookies.set("admin", "true", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  res.cookies.set("csrf_token", csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return res;
}

export async function POST(req) {
  const { password, pin } = await req.json();

  const pinEnabled =
    process.env.PIN_STATUS === "enabled";

  if (password) {
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Password salah" },
        { status: 401 }
      );
    }

    if (pinEnabled) {
      return NextResponse.json({
        need_pin: true,
      });
    }

    return createAuthResponse();
  }

  if (pin) {
    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json(
        { error: "PIN salah" },
        { status: 401 }
      );
    }

    return createAuthResponse();
  }

  return NextResponse.json(
    { error: "Invalid request" },
    { status: 400 }
  );
}
