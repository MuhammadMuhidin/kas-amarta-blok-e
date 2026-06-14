import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getMasterManagementOverview, saveApprovalMaster } from "@/features/approval/approvalService";
import {
  archiveLifecycleMaster,
  deleteInitialDraft,
  discardLifecycleDraft,
  saveLifecycleDraft,
} from "@/features/approval/approvalMasterLifecycleService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(message = "") {
  return /wajib|minimal|duplikat|pilihan|nominal|validasi|tidak ditemukan|draft|arsip|archived|dipublikasikan|dihapus/i.test(String(message)) ? 400 : 500;
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
    const operation = String(body?.operation || "").trim().toLowerCase();
    const lifecycle = String(body?.lifecycle_status || "").trim().toLowerCase();

    if (operation === "discard_draft") {
      return NextResponse.json(await discardLifecycleDraft({ req, payload: body }));
    }

    if (operation === "delete_initial_draft") {
      return NextResponse.json(await deleteInitialDraft({ req, payload: body }));
    }

    if (body?.id && lifecycle === "archived") {
      return NextResponse.json(await archiveLifecycleMaster({ req, payload: body }));
    }

    if (body?.id && lifecycle === "draft") {
      return NextResponse.json(await saveLifecycleDraft({ req, payload: body }));
    }

    return NextResponse.json(await saveApprovalMaster({ req, payload: body }));
  } catch (err) {
    const message = err.message || "Gagal menyimpan approval master";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
