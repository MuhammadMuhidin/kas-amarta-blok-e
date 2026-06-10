import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import {
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
import { createAuthResponse } from "@/features/auth/loginResponseService";
import { resolveAdminAccessRole } from "@/lib/adminRoles";

export const runtime = "nodejs";

const PENDING_ACCESS_ROLE_COOKIE = "admin_pending_access_role";

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

    const accessRole = resolveAdminAccessRole(
      req.cookies.get(PENDING_ACCESS_ROLE_COOKIE)?.value,
    );

    const res = await createAuthResponse(req, {
      clearWebAuthChallenge: true,
      accessRole,
    });

    res.cookies.delete(PENDING_ACCESS_ROLE_COOKIE);

    return res;
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
