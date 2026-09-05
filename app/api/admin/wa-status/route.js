import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getAuthConfigs } from "@/lib/webauth";

export const runtime = "nodejs";

// Read-only endpoint for checking WA services status.
// Uses isAdmin (not isAdministrator) so bendahara can also read.
export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const configs = await getAuthConfigs();

    return NextResponse.json({
      ok: true,
      whatsappServicesEnabled: configs.WA_SERVICES_ENABLED !== "false",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal mengambil status WhatsApp" },
      { status: 500 },
    );
  }
}
