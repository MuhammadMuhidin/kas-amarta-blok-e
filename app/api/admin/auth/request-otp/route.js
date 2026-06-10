import { NextResponse } from "next/server";
import { createPendingAdminOtp, generateAdminOtp, markAdminOtpFailed, markAdminOtpSent } from "@/lib/adminLoginOtp";
import { getAdminAccessRoleLabel, assertAdminAccessRole } from "@/lib/adminRoles";
import { getAdminRoleContact } from "@/lib/adminRoleContacts";
import { normalizePhoneToWaChatId, sendWaMessage } from "@/lib/waClient";
import { recordAdminActivity } from "@/lib/adminActivity";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";

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
    const body = await req.json();
    role = assertAdminAccessRole(body?.role);

    const limit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.adminLoginOtpRequest, {
      targetId: role,
    });

    if (limit) return limit;

    const contact = await getAdminRoleContact(role);
    const otp = generateAdminOtp();
    otpId = await createPendingAdminOtp({ role, otp });

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
