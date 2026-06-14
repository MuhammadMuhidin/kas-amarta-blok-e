import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { reactivateLifecycleMaster } from "@/features/approval/approvalMasterLifecycleSafeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const body = await req.json();
    return NextResponse.json(await reactivateLifecycleMaster({ req, payload: body }));
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal mengaktifkan kembali approval master" },
      { status: Number(err?.status) || (/Archived|tidak ditemukan|wajib/i.test(String(err?.message || "")) ? 400 : 500) },
    );
  }
}
