import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getRoleManagementOverview } from "@/features/roleManagement/roleManagementService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();

    const result = await getRoleManagementOverview(req);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal membaca role management" },
      { status: 500 },
    );
  }
}
