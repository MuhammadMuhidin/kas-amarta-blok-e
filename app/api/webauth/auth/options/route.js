import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { getActiveCredentials, getWebAuthConfig } from "@/lib/webauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rpID } = getWebAuthConfig();

    const credentials = await getActiveCredentials();

    if (!credentials.length) {
      return NextResponse.json(
        {
          error: "Credential WebAuth not registered",
        },
        {
          status: 404,
        },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        type: "public-key",
      })),
    });

    const res = NextResponse.json(options);

    res.cookies.set("webauth_login_challenge", options.challenge, {
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
        error: err.message || "Failed to create auth options",
      },
      {
        status: 500,
      },
    );
  }
}
