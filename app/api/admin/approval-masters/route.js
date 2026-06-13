import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getMasterManagementOverview, saveApprovalMaster } from "@/features/approval/approvalService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(message = "") {
  return /wajib|minimal|duplikat|pilihan|nominal|validasi|tidak ditemukan|draft/i.test(String(message)) ? 400 : 500;
}

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    return NextResponse.json(await getMasterManagementOverview());
  } catch (err) {
    return NextResponse.json({ error: err.message || "Gagal membaca approval masters" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    const body = await req.json();
    return NextResponse.json(await saveApprovalMaster({ req, payload: body }));
  } catch (err) {
    const message = err.message || "Gagal menyimpan approval master";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
