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

const WHATSAPP_SESSION_ERROR_TERMS = [
  "loggedout",
  "logged out",
  "logout",
  "unpaired",
  "pairing ulang",
  "perlu pairing",
  "session whatsapp perlu pairing",
  "whatsapp belum connected",
  "whatsapp is not connected",
  "not connected",
  "timeout menunggu koneksi whatsapp",
];

const WHATSAPP_DELIVERY_ERROR_TERMS = [
  "wa_api_url",
  "wa_api_key",
  "gagal mengirim whatsapp",
  "failed to send whatsapp",
  "whatsapp belum mengembalikan status terkirim",
  "unauthorized",
];

function buildOtpMessage({ role, otp }) {
  const label = getAdminAccessRoleLabel(role);
  return `Kode OTP login pengurus ${label}: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`;
}

function classifyWhatsAppDeliveryError(error) {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();

  if (WHATSAPP_SESSION_ERROR_TERMS.some((term) => normalized.includes(term))) {
    return {
      status: 503,
      error_code: "WHATSAPP_SESSION_UNAVAILABLE",
      error: "WhatsApp Services are active, but the WhatsApp session is logged out. Please contact the administrator.",
    };
  }

  if (WHATSAPP_DELIVERY_ERROR_TERMS.some((term) => normalized.includes(term))) {
    return {
      status: 503,
      error_code: "WHATSAPP_DELIVERY_UNAVAILABLE",
      error: "WhatsApp Services are active, but OTP delivery is unavailable. Please contact the administrator.",
    };
  }

  return null;
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
        error_code: "WHATSAPP_SERVICES_DISABLED",
        login_otp: otp,
        message: "WhatsApp Services are disabled. Login will continue without a WhatsApp OTP.",
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

    return NextResponse.json({
      ok: true,
      otp_delivery: "whatsapp",
      error_code: "WHATSAPP_OTP_SENT",
      message: "OTP sent to the registered WhatsApp number.",
    });
  } catch (err) {
    if (otpId) {
      try {
        await markAdminOtpFailed(otpId);
      } catch {
        // ignore secondary failure
      }
    }

    const whatsappFailure = classifyWhatsAppDeliveryError(err);

    await recordAdminActivity(req, {
      type: "otp-request",
      module: "login",
      severity: "error",
      message: `OTP login request failed${role ? ` for ${role}` : ""}`,
      metadata: {
        role: role || null,
        error: err.message || "Unknown error",
        error_code: whatsappFailure?.error_code || "OTP_REQUEST_FAILED",
      },
    });

    if (whatsappFailure) {
      return NextResponse.json(
        {
          error: whatsappFailure.error,
          error_code: whatsappFailure.error_code,
          whatsapp_services_enabled: true,
        },
        { status: whatsappFailure.status },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to request an OTP. Please contact the administrator.",
        error_code: "OTP_REQUEST_FAILED",
      },
      { status: 400 },
    );
  }
}
