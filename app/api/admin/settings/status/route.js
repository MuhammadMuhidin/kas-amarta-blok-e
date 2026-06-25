import { NextResponse } from "next/server";
import { isEmailNotificationsEnabled } from "@/lib/appConfig";
import { isWhatsAppServicesEnabled } from "@/lib/webauth";
import { isAdmin, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const [emailEnabled, whatsappEnabled] = await Promise.all([
      isEmailNotificationsEnabled(),
      isWhatsAppServicesEnabled(),
    ]);

    return NextResponse.json({
      ok: true,
      email_notifications_enabled: emailEnabled,
      whatsapp_services_enabled: whatsappEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal membaca status layanan" },
      { status: 500 },
    );
  }
}
