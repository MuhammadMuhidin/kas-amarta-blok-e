import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
}

function mapTrash(row) {
  return {
    id: row.id,
    payment_id: row.payment_id,
    amount: Number(row.amount) || 0,
    date: row.date,
  };
}

export async function GET(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from(TRASH_TABLE)
    .select("id,payment_id,amount,date");

  if (error) {
    return NextResponse.json({ error: "Gagal membaca data sampah" }, { status: 500 });
  }

  return NextResponse.json((rows || []).map(mapTrash));
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json();
    const paymentId = normalize(body.payment_id);
    const amount = Number(body.amount || 0);

    if (!paymentId || !amount) {
      return NextResponse.json(
        { error: "Payment ID and amount are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: existingRows, error: readError } = await supabase
      .from(TRASH_TABLE)
      .select("id,payment_id,amount,date")
      .eq("payment_id", paymentId)
      .limit(1);

    if (readError) {
      return NextResponse.json({ error: readError.message || "Gagal membaca data sampah" }, { status: 500 });
    }

    const existingTrash = existingRows?.[0];

    if (existingTrash) {
      await recordAdminActivity(req, {
        type: "idempotent",
        module: "trash",
        severity: "info",
        message: `Reuse existing trash payment ${paymentId}`,
        metadata: {
          trash_id: existingTrash.id,
          payment_id: paymentId,
          amount: Number(existingTrash.amount) || amount,
          date: existingTrash.date || null,
        },
      });

      return NextResponse.json({
        success: true,
        existing: true,
        trash_id: existingTrash.id,
      });
    }

    const trashId = generateId("TRASH-");
    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from(TRASH_TABLE).insert({
      id: trashId,
      payment_id: paymentId,
      amount,
      date: today,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Gagal menyimpan data sampah" }, { status: 500 });
    }

    await recordAdminActivity(req, {
      type: "create",
      module: "trash",
      severity: "success",
      message: `Record trash payment ${paymentId}`,
      metadata: {
        trash_id: trashId,
        payment_id: paymentId,
        amount,
        date: today,
        actor: "system",
      },
    });

    return NextResponse.json({
      success: true,
      trash_id: trashId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      },
    );
  }
}
