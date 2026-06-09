import { NextResponse } from "next/server";
import { getAuthConfigs } from "@/lib/webauth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";
import { createAuthResponse } from "@/features/auth/loginResponseService";

export async function POST(req) {
  try {
    const passwordLimit = await enforceFailureRateLimit(
      req,
      RATE_LIMIT_SCOPES.loginPasswordFailed,
    );

    if (passwordLimit) return passwordLimit;

    const { password, pin } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.loginPasswordFailed);

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

    if (pinEnabled) {
      if (!pin) {
        return NextResponse.json({
          need_pin: true,
          need_webauth: false,
        });
      }

      const pinLimit = await enforceFailureRateLimit(
        req,
        RATE_LIMIT_SCOPES.loginPinFailed,
      );

      if (pinLimit) return pinLimit;

      if (pin !== process.env.ADMIN_PIN) {
        await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.loginPinFailed);

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

    await clearRateLimit(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
    await clearRateLimit(req, RATE_LIMIT_SCOPES.loginPinFailed);

    if (webAuthEnabled) {
      return NextResponse.json({
        need_webauth: true,
      });
    }

    return createAuthResponse(req);
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
