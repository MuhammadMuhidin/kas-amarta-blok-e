import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { actOnApprovalRequest, getApprovalCenterOverview } from "@/features/approval/approvalService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const session = await getCurrentAdminSession(req);
    return NextResponse.json(await getApprovalCenterOverview({ accessRole: session?.access_role || "admin" }));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca Approval Center" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const session = await getCurrentAdminSession(req);
    const body = await req.json();
    return NextResponse.json(await actOnApprovalRequest({
      req,
      accessRole: session?.access_role || "admin",
      id: body.id,
      action: body.action,
      note: body.note,
    }));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal memproses approval" }, { status: 500 });
  }
}
