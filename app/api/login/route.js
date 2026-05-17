import { NextResponse } from "next/server";
import {
  createCSRFToken,
  isWebAuthEnabled,
} from "@/lib/webauth";

function createAuthResponse() {
  const csrfToken =
    createCSRFToken();

  const res =
    NextResponse.json({
      ok: true,
    });

  res.cookies.set("admin", "true", {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
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
    const { password } =
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

    const enabled =
      await isWebAuthEnabled();

    if (enabled) {
      return NextResponse.json({
        need_webauth: true,
      });
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
