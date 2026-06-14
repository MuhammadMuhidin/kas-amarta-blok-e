import { NextResponse } from "next/server";

import { unauthorized } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getAllowedAdminModules } from "@/lib/adminAccessMatrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

export async function GET(req) {
  const session = await getCurrentAdminSession(req);

  if (!session) {
    const res = unauthorized();
    Object.entries(SESSION_HEADERS).forEach(([name, value]) => res.headers.set(name, value));
    return res;
  }

  const modules = await getAllowedAdminModules(session.access_role);

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    access_role: session.access_role,
    modules,
  }, {
    headers: SESSION_HEADERS,
  });
}
