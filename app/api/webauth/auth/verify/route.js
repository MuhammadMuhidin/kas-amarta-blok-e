import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import {
  createAdminSession,
  getSessionCookieName,
} from "@/lib/adminSession";

import {
  createCSRFToken,
  getAdminSessionDuration,
  getCredentialById,
  getWebAuthConfig,
  updateCounter,
} from "@/lib/webauth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

async function createAuthResponse(req) {
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

  res.cookies.delete("webauth_login_challenge");

  return res;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const credentialId = body?.id;
    const rateLimitOptions = {
      targetId: credentialId,
    };

    const verifyLimit = await enforceFailureRateLimit(
      req,
      RATE_LIMIT_SCOPES.webauthVerifyFailed,
      rateLimitOptions,
    );

    if (verifyLimit) return verifyLimit;

    const challenge = req.cookies.get("webauth_login_challenge")?.value;

    if (!challenge) {
      await recordRateLimitFailure(
        req,
        RATE_LIMIT_SCOPES.webauthVerifyFailed,
        rateLimitOptions,
      );

      return NextResponse.json(
        {
          error: "Challenge login expired",
        },
        { status: 401 },
      );
    }

    const savedCredential = await getCredentialById(credentialId);

    if (!savedCredential) {
      await recordRateLimitFailure(
        req,
        RATE_LIMIT_SCOPES.webauthVerifyFailed,
        rateLimitOptions,
      );

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
      await recordRateLimitFailure(
        req,
        RATE_LIMIT_SCOPES.webauthVerifyFailed,
        rateLimitOptions,
      );

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

    await clearRateLimit(
      req,
      RATE_LIMIT_SCOPES.webauthVerifyFailed,
      rateLimitOptions,
    );

    return createAuthResponse(req);
  } catch (err) {
    await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.webauthVerifyFailed);

    return NextResponse.json(
      {
        error: err.message || "Verify WebAuth login failed",
      },
      { status: 500 },
    );
  }
}
