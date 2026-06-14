import { NextResponse } from "next/server";

import { unauthorized } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { getProfileOverview } from "@/features/profile/profileOverviewService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

export async function GET(req) {
  try {
    const session = await getCurrentAdminSession(req);
    if (!session) {
      const res = unauthorized();
      Object.entries(HEADERS).forEach(([name, value]) => res.headers.set(name, value));
      return res;
    }

    const result = await getProfileOverview(req, session);
    return NextResponse.json(result, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal memuat profile" },
      { status: 500, headers: HEADERS },
    );
  }
}
