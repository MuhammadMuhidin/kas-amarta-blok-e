import { NextResponse } from "next/server";

import {
  getSessionCookieName,
} from "@/lib/adminSession";

export async function POST() {
  const res = NextResponse.json({
    ok: true,
  });

  res.cookies.delete(getSessionCookieName());
  res.cookies.delete("csrf_token");
  res.cookies.delete("admin");

  return res;
}
