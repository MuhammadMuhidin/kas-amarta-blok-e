import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { listBackupSummary } from "@/features/summaryBackup/summaryBackupService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(req.url);
    const result = await listBackupSummary(searchParams);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
