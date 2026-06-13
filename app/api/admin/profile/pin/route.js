import { NextResponse } from "next/server";

import { unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";
import { changeOwnCredential } from "@/features/profile/profileCredentialService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req) {
  try {
    const session = await getCurrentAdminSession(req);
    if (!session) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const limit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.profileCredentialUpdate, {
      identity: "session",
      targetId: `pin:${session.access_role}`,
    });
    if (limit) return limit;

    const body = await req.json();
    return NextResponse.json(await changeOwnCredential({
      req,
      session,
      type: "pin",
      value: body?.new_pin,
      confirmation: body?.confirmation,
    }));
  } catch (err) {
    const message = err.message || "Gagal memperbarui PIN";
    const status = /Konfirmasi|harus|terlalu mudah|tidak valid|bersamaan/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
