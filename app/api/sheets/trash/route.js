import { NextResponse } from "next/server";
import { dbTable } from "@/lib/dbTable";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;
const TRASH_TABLE = dbTable("trash");

function normalize(value) {
  return String(value || "").trim();
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

  const data = (rows || []).map((r) => ({
    id: r.id,
    payment_id: r.payment_id,
    amount: Number(r.amount) || 0,
    date: r.date,
  }));

  return NextResponse.json(data);
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

    const sheets = await getSheets();
    const trashRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Trash!A:D",
    });
    const trashRows = trashRes.data.values || [];
    const existingTrash = trashRows.slice(1).find((r) => normalize(r[1]) === paymentId);

    if (existingTrash) {
      await recordAdminActivity(req, {
        type: "idempotent",
        module: "trash",
        severity: "info",
        message: `Reuse existing trash payment ${paymentId}`,
        metadata: {
          trash_id: existingTrash[0],
          payment_id: paymentId,
          amount: Number(existingTrash[2]) || amount,
          date: existingTrash[3] || null,
        },
      });

      return NextResponse.json({
        success: true,
        existing: true,
        trash_id: existingTrash[0],
      });
    }

    const trashId = generateId("TRASH-");
    const today = new Date().toISOString().slice(0, 10);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "trash!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[trashId, paymentId, amount, today]],
      },
    });

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
