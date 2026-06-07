import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  return NextResponse.json({
    ok: true,
    disabled: true,
    count: 0,
    name: "Supabase source of truth",
    created_at: "Google Drive backup disabled",
  });
}
