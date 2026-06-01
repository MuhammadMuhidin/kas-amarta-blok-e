import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { getAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID;

function normalize(value) {
  return String(value || "").trim();
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = normalize(body.payment_id);

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const sheets = await getSheets();
    const [paymentRes, personalRes, trashRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Payment!A:G" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Personal!A:F" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Trash!A:D" }),
    ]);

    const paymentRows = paymentRes.data.values || [];
    const payment = paymentRows.slice(1).find((row) => normalize(row[0]) === paymentId);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const personalRows = personalRes.data.values || [];
    const member = personalRows.slice(1).find((row) => normalize(row[0]) === normalize(payment[1]));

    if (!member) {
      return NextResponse.json({ error: "Payment person not found" }, { status: 404 });
    }

    if (normalize(member[3]).toUpperCase() !== "Y") {
      return NextResponse.json({ error: "Person is not registered for trash payment" }, { status: 400 });
    }

    const trashRows = trashRes.data.values || [];
    const existingTrash = trashRows.slice(1).find((row) => normalize(row[1]) === paymentId);

    if (existingTrash) {
      return NextResponse.json({
        success: true,
        existing: true,
        trash_id: existingTrash[0],
      });
    }

    const appConfig = await getAppConfig();
    const trashAmount = Number(appConfig?.trash_fee || 0);

    if (!trashAmount) {
      return NextResponse.json({ error: "Tarif sampah belum dikonfigurasi" }, { status: 400 });
    }

    const trashId = generateId("TRASH-");
    const date = normalize(payment[6]) || new Date().toISOString().slice(0, 10);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Trash!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[trashId, paymentId, trashAmount, date]],
      },
    });

    await recordAdminActivity(req, {
      type: "repair",
      module: "trash",
      severity: "success",
      message: `Repair missing trash record ${payment[2] || "-"} ${payment[4] || "-"}`,
      metadata: {
        trash_id: trashId,
        payment_id: paymentId,
        person_id: payment[1],
        house: payment[2],
        name: payment[3],
        period: payment[4],
        amount: trashAmount,
        date,
      },
    });

    return NextResponse.json({
      success: true,
      repaired: true,
      trash_id: trashId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
