import { NextResponse } from "next/server";
import { createWebAuthRegistrationOptions } from "@/features/auth/webauthRegistrationService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const options = await createWebAuthRegistrationOptions();
    const res = NextResponse.json(options);

    res.cookies.set("webauth_register_challenge", options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 5,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Failed to create register options",
      },
      {
        status: 500,
      },
    );
  }
}
