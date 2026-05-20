import { NextResponse } from "next/server";

import {
  isAdmin,
  unauthorized,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  return NextResponse.json({
    ok: true,
  });
}