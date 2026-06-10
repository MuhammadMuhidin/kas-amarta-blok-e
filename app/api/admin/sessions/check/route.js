import { NextResponse } from "next/server";

import { unauthorized } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getAllowedAdminModules } from "@/lib/adminAccessMatrix";

export const runtime = "nodejs";

export async function GET(req) {
  const session = await getCurrentAdminSession(req);

  if (!session) {
    return unauthorized();
  }

  const modules = await getAllowedAdminModules(session.access_role);

  return NextResponse.json({
    ok: true,
    access_role: session.access_role,
    modules,
  });
}
