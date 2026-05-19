import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import {
  createCSRFToken,
  getActiveCredential,
  getWebAuthConfig,
  updateCounter,
} from "@/lib/webauth";

export const runtime = "nodejs";

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

  res.cookies.delete("webauth_login_challenge");

  return res;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const challenge = req.cookies.get("webauth_login_challenge")?.value;

    if (!challenge) {
      return NextResponse.json(
        {
          error: "Challenge login expired",
        },
        { status: 401 },
      );
    }

    const savedCredential = await getActiveCredential();

    if (!savedCredential) {
      return NextResponse.json(
        {
          error: "Credential WebAuth not registered",
        },
        { status: 404 },
      );
    }

    const { rpID, origin } = getWebAuthConfig();

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,

      credential: {
        id: savedCredential.credential_id,

        publicKey: new Uint8Array(
          Buffer.from(savedCredential.public_key, "base64url"),
        ),

        counter: savedCredential.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        {
          error: "Verify WebAuth failed",
        },
        { status: 401 },
      );
    }

    await updateCounter(
      savedCredential.id,
      verification.authenticationInfo.newCounter,
    );

    return createAuthResponse();
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Verify WebAuth login failed",
      },
      { status: 500 },
    );
  }
}
