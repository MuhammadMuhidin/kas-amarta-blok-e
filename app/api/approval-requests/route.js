import { NextResponse } from "next/server";
import { checkApprovalStatus, getApprovalMasters, submitApprovalRequest } from "@/features/approval/approvalService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestNo = searchParams.get("request_no");
    const requesterKey = searchParams.get("key");

    if (requestNo || requesterKey) {
      return NextResponse.json(await checkApprovalStatus({ requestNo, requesterKey }));
    }

    const masters = await getApprovalMasters({ activeOnly: true });
    return NextResponse.json({ ok: true, masters });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval requests" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(await submitApprovalRequest(body));
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membuat approval request" }, { status: 500 });
  }
}
