import { NextResponse } from "next/server";
import { createCSRFToken, getAuthConfigs } from "@/lib/webauth";

function createAuthResponse() {
  const csrfToken = createCSRFToken();

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
  try {
    const { password, pin } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          error: "Wrong password",
        },
        {
          status: 401,
        },
      );
    }

    const { webAuthEnabled, pinEnabled } = await getAuthConfigs();

    /*
      STEP 1
      PIN
    */

    if (pinEnabled) {
      if (!pin) {
        return NextResponse.json({
          need_pin: true,
          need_webauth: false,
        });
      }

      if (pin !== process.env.ADMIN_PIN) {
        return NextResponse.json(
          {
            error: "Wrong PIN",
          },
          {
            status: 401,
          },
        );
      }
    }

    /*
      STEP 2
      WEBAUTH
    */

    if (webAuthEnabled) {
      return NextResponse.json({
        need_webauth: true,
      });
    }

    /*
      STEP 3
      LOGIN
    */

    return createAuthResponse();
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Sign in failed",
      },
      {
        status: 500,
      },
    );
  }
}
