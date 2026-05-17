import { NextResponse } from "next/server";
import {
  createCSRFToken,
  getAuthConfigs,
} from "@/lib/webauth";

function createAuthResponse() {
  const csrfToken = createCSRFToken();

  const res = NextResponse.json({
    ok: true,
  });

  res.cookies.set("admin", "true", {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  res.cookies.set(
    "csrf_token",
    csrfToken,
    {
      httpOnly: false,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
    }
  );

  return res;
}

export async function POST(req) {
  try {
    const { password, pin } =
      await req.json();

    if (!password) {
      return NextResponse.json(
        {
          error: "Password wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password !==
      process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        {
          error: "Password salah",
        },
        {
          status: 401,
        }
      );
    }

    const {
      webAuthEnabled,
      pinEnabled,
    } = await getAuthConfigs();

    if (webAuthEnabled) {
      return NextResponse.json({
        need_webauth: true,
      });
    }

    if (pinEnabled) {
      if (!pin) {
        return NextResponse.json({
          need_pin: true,
        });
      }

      if (
        pin !== process.env.ADMIN_PIN
      ) {
        return NextResponse.json(
          {
            error: "PIN salah",
          },
          {
            status: 401,
          }
        );
      }
    }

    return createAuthResponse();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Login gagal",
      },
      {
        status: 500,
      }
    );
  }
}
