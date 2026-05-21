import { NextResponse } from "next/server";
import buildInfo from "@/lib/generated/build-info.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    build: buildInfo,
  });
}
