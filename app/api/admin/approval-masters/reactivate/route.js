import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVAL_MASTERS_TABLE = dbTable("approval_masters");

function clean(value) {
  return String(value || "").trim();
}

function parseEnvelope(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !clean(value)) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function lifecycleStatus(row, envelope) {
  return clean(envelope?.meta?.lifecycle_status || (row?.active ? "active" : "draft")).toLowerCase();
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const { id } = await req.json();
    const masterId = clean(id);
    if (!masterId) {
      return NextResponse.json({ error: "ID approval master wajib diisi" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from(APPROVAL_MASTERS_TABLE)
      .select("*")
      .eq("id", masterId)
      .maybeSingle();

    if (readError) throw new Error(readError.message || "Gagal membaca approval master");
    if (!current) {
      return NextResponse.json({ error: "Approval master tidak ditemukan" }, { status: 404 });
    }

    const envelope = parseEnvelope(current.fields_schema);
    if (lifecycleStatus(current, envelope) !== "archived") {
      return NextResponse.json(
        { error: "Hanya approval master berstatus Archived yang dapat diaktifkan kembali" },
        { status: 400 },
      );
    }

    const published = envelope?.published;
    if (!published || !Number(published.revision || 0)) {
      return NextResponse.json(
        { error: "Versi published sebelumnya tidak ditemukan" },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();
    const nextEnvelope = {
      ...envelope,
      meta: {
        ...(envelope.meta || {}),
        lifecycle_status: "active",
        published_revision: Number(published.revision || 0),
        draft_revision: Number(envelope?.draft?.revision || 0),
        published_at: clean(published.published_at || envelope?.meta?.published_at),
        updated_at: timestamp,
      },
      fields: Array.isArray(published.fields_schema)
        ? published.fields_schema
        : Array.isArray(envelope.fields)
          ? envelope.fields
          : [],
      published,
      draft: envelope.draft || null,
      history: Array.isArray(envelope.history) ? envelope.history : [],
    };

    const payload = {
      code: clean(published.code || current.code),
      name: clean(published.name || current.name),
      description: clean(published.description || current.description),
      category: clean(published.category || current.category),
      active: true,
      payment_required: Boolean(published.payment_required),
      payment_amount: Number(published.payment_amount || 0),
      payment_instruction: clean(published.payment_instruction),
      fields_schema: nextEnvelope,
      flow_schema: Array.isArray(published.flow_schema) ? published.flow_schema : current.flow_schema,
      updated_at: timestamp,
    };

    const { data: updated, error: updateError } = await supabase
      .from(APPROVAL_MASTERS_TABLE)
      .update(payload)
      .eq("id", masterId)
      .eq("active", false)
      .select("id,code,name,active,fields_schema,updated_at")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message || "Gagal mengaktifkan approval master");
    if (!updated) {
      return NextResponse.json(
        { error: "Status approval master berubah. Muat ulang halaman dan coba kembali." },
        { status: 409 },
      );
    }

    await recordAdminActivity(req, {
      type: "update",
      module: "master-management",
      severity: "success",
      message: `Reactivate approval master ${payload.code} menggunakan versi ${published.revision}`,
      metadata: {
        id: masterId,
        code: payload.code,
        lifecycle_status: "active",
        published_revision: Number(published.revision),
        revision_changed: false,
      },
    });

    return NextResponse.json({
      ok: true,
      master: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        active: updated.active,
        lifecycle_status: "active",
        published_revision: Number(published.revision),
      },
      message: `Versi ${published.revision} berhasil diaktifkan kembali tanpa membuat versi baru.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal mengaktifkan kembali approval master" },
      { status: 500 },
    );
  }
}
