import { NextResponse } from "next/server";
import { getAuthConfigs } from "@/lib/webauth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";
import { createAuthResponse } from "@/features/auth/loginResponseService";
import { assertAdminAccessRole } from "@/lib/adminRoles";
import { validateAdminOtp } from "@/lib/adminLoginOtp";

export const runtime = "nodejs";

const PENDING_ACCESS_ROLE_COOKIE = "admin_pending_access_role";
const PENDING_OTP_ID_COOKIE = "admin_pending_otp_id";

function webAuthRequired({ accessRole, otpContext }) {
  const res = NextResponse.json({ need_webauth: true, access_role: accessRole });

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  };

  res.cookies.set(PENDING_ACCESS_ROLE_COOKIE, accessRole, cookieOptions);
  res.cookies.set(PENDING_OTP_ID_COOKIE, otpContext.id, cookieOptions);

  return res;
}

export async function POST(req) {
  try {
    const passwordLimit = await enforceFailureRateLimit(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
    if (passwordLimit) return passwordLimit;

    const { role, otp, password, pin } = await req.json();
    const accessRole = assertAdminAccessRole(role);
    const otpContext = await validateAdminOtp({ role: accessRole, otp, consume: false });

    if (password !== process.env.ADMIN_PASSWORD) {
      await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const { webAuthEnabled, pinEnabled } = await getAuthConfigs();

    if (pinEnabled) {
      if (!pin) {
        return NextResponse.json({ need_pin: true, need_webauth: false, access_role: accessRole });
      }

      const pinLimit = await enforceFailureRateLimit(req, RATE_LIMIT_SCOPES.loginPinFailed);
      if (pinLimit) return pinLimit;

      if (pin !== process.env.ADMIN_PIN) {
        await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.loginPinFailed);
        return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
      }
    }

    await clearRateLimit(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
    await clearRateLimit(req, RATE_LIMIT_SCOPES.loginPinFailed);

    if (webAuthEnabled) return webAuthRequired({ accessRole, otpContext });

    return createAuthResponse(req, { accessRole, otpContext });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Sign in failed" }, { status: 500 });
  }
}
