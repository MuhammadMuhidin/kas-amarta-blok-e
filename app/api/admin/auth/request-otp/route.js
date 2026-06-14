import { NextResponse } from "next/server";
import { createPendingAdminOtp, generateAdminOtp, markAdminOtpFailed, markAdminOtpSent } from "@/lib/adminLoginOtp";
import { getAdminAccessRoleLabel, assertAdminAccessRole } from "@/lib/adminRoles";
import { getAdminRoleContact } from "@/lib/adminRoleContacts";
import { verifyAdminRolePassword } from "@/lib/adminRoleCredentials";
import { normalizePhoneToWaChatId, sendWaMessage } from "@/lib/waClient";
import { recordAdminActivity } from "@/lib/adminActivity";
import { getAuthConfigs } from "@/lib/webauth";
import {
  enforceFailureRateLimit,
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildOtpMessage({ role, otp }) {
  const label = getAdminAccessRoleLabel(role);
  return `Kode OTP login pengurus ${label}: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`;
}

export async function POST(req) {
  let otpId = null;
  let role = "";

  try {
    const passwordLimit = await enforceFailureRateLimit(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
    if (passwordLimit) return passwordLimit;

    const body = await req.json();
    role = assertAdminAccessRole(body?.role);
    const password = String(body?.password || "");

    if (!(await verifyAdminRolePassword(role, password))) {
      await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.loginPasswordFailed);
      await recordAdminActivity(req, {
        type: "otp-request",
        module: "login",
        severity: "error",
        message: `OTP login request blocked by wrong password for ${role}`,
        metadata: { role },
      });

      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const limit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.adminLoginOtpRequest, {
      targetId: role,
    });

    if (limit) return limit;

    const contact = await getAdminRoleContact(role);
    const { whatsappServicesEnabled } = await getAuthConfigs();
    const otp = generateAdminOtp();
    otpId = await createPendingAdminOtp({ role, otp });

    if (whatsappServicesEnabled === false) {
      await markAdminOtpSent(otpId);

      await recordAdminActivity(req, {
        type: "otp-request",
        module: "login",
        severity: "success",
        message: `OTP login continued without WhatsApp delivery for ${role}`,
        metadata: { role, whatsapp_services_enabled: false },
      });

      return NextResponse.json({
        ok: true,
        otp_delivery: "disabled",
        login_otp: otp,
        message: "WhatsApp Services sedang OFF. Login dilanjutkan tanpa pengiriman OTP WhatsApp.",
      });
    }

    await sendWaMessage({
      chatId: normalizePhoneToWaChatId(contact.phone),
      text: buildOtpMessage({ role, otp }),
    });

    await markAdminOtpSent(otpId);

    await recordAdminActivity(req, {
      type: "otp-request",
      module: "login",
      severity: "success",
      message: `OTP login requested for ${role}`,
      metadata: { role },
    });

    return NextResponse.json({ ok: true, message: "OTP terkirim ke WhatsApp role terdaftar" });
  } catch (err) {
    if (otpId) {
      try {
        await markAdminOtpFailed(otpId);
      } catch {
        // ignore secondary failure
      }
    }

    await recordAdminActivity(req, {
      type: "otp-request",
      module: "login",
      severity: "error",
      message: `OTP login request failed${role ? ` for ${role}` : ""}`,
      metadata: { role: role || null, error: err.message || "Unknown error" },
    });

    return NextResponse.json(
      { error: err.message || "Gagal mengirim OTP" },
      { status: 400 },
    );
  }
}
