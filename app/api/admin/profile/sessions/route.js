import { NextResponse } from "next/server";

import { unauthorized, validateCSRF } from "@/lib/auth";
import {
  getAdminSessions,
  getCurrentAdminSession,
  revokeAdminSession,
} from "@/lib/adminSession";
import { recordAdminActivity } from "@/lib/adminActivity";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req) {
  try {
    const currentSession = await getCurrentAdminSession(req);
    if (!currentSession) return unauthorized();
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json();
    const targetId = String(body?.id || "").trim();
    if (!targetId) {
      return NextResponse.json({ error: "Session tidak valid" }, { status: 400 });
    }

    const limit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.sessionRevoke, {
      identity: "session",
      targetId: `profile-session:${targetId}`,
    });
    if (limit) return limit;

    const sessions = await getAdminSessions(req);
    const target = sessions.find((item) => String(item.id) === targetId);

    if (!target || target.access_role !== currentSession.access_role) {
      return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
    }
    if (target.current || targetId === String(currentSession.id)) {
      return NextResponse.json(
        { error: "Gunakan tombol Keluar dari Akun untuk mengakhiri sesi saat ini" },
        { status: 400 },
      );
    }

    await revokeAdminSession(targetId);
    await recordAdminActivity(req, {
      type: "revoke",
      module: "session",
      severity: "warning",
      message: "Sesi perangkat dicabut dari halaman profile",
      metadata: {
        access_role: currentSession.access_role,
        session_id: targetId,
        device_name: target.device_name || null,
        location: target.location || null,
        last_active: target.last_active || null,
        current: false,
      },
    });

    return NextResponse.json({ ok: true, message: "Sesi berhasil dicabut" });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mencabut session" },
      { status: 500 },
    );
  }
}
