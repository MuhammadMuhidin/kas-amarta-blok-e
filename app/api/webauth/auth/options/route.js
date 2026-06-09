import { NextResponse } from "next/server";
import { createWebAuthAuthenticationOptions } from "@/features/auth/webauthAuthenticationService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await createWebAuthAuthenticationOptions();
    const res = NextResponse.json(result.body, { status: result.status });

    if (result.status === 200) {
      res.cookies.set("webauth_login_challenge", result.body.challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 5,
      });
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Failed to create auth options",
      },
      {
        status: 500,
      },
    );
  }
}
