import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { listAdminActivities } from "@/features/activity/activityService";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const result = await listAdminActivities(searchParams);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal membaca activity audit" },
      { status: 500 },
    );
  }
}
