import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { generateId } from "@/lib/id";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { uploadCashflowReceipt } from "@/lib/r2Upload";
import { withMediaReceiptUrl } from "@/lib/mediaUrl";
import {
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const spreadsheetId = process.env.SPREADSHEET_ID;

function normalize(value) {
  return String(value || "").trim();
}

function toTitleCase(str = "") {
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function numberParam(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDirectCashflow(item) {
  return String(item.ref_id || "").startsWith("DIRECT-");
}

function sortCashflow(rows) {
  return [...rows].sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;

    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

function filterCashflow(rows, type) {
  if (["income", "expense"].includes(type)) {
    return rows.filter((item) => item.type === type);
  }

  return rows;
}

function buildSummary(rows) {
  const income = rows
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const expense = rows
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  return {
    income,
    expense,
    net: income - expense,
  };
}

export async function GET(req) {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Cashflow!A:G",
  });

  const rows = res.data.values || [];

  const data = rows.slice(1).map((r) => withMediaReceiptUrl({
    id: r[0],
    ref_id: r[1],
    type: (r[2] || "").toLowerCase(),
    amount: Number(r[3]) || 0,
    note: r[4],
    date: r[5],
    receipt_url: r[6] || "",
  }));

  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page") || searchParams.has("limit");

  if (!paginated) {
    return NextResponse.json(data);
  }

  const page = Math.max(numberParam(searchParams.get("page"), 1), 1);
  const limitRaw = numberParam(searchParams.get("limit"), 10);
  const limit = Math.min(Math.max(limitRaw, 5), 50);
  const type = normalize(searchParams.get("type")).toLowerCase();
  const directOnly = searchParams.get("source") === "direct";
  const from = (page - 1) * limit;
  const to = from + limit;

  const scoped = directOnly ? data.filter(isDirectCashflow) : data;
  const filtered = filterCashflow(sortCashflow(scoped), type);

  return NextResponse.json({
    ok: true,
    cashflows: filtered.slice(from, to),
    summary: buildSummary(scoped),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.max(Math.ceil(filtered.length / limit), 1),
    },
  });
}

export async function POST(req) {
  if (!(await isAdmin(req))) {
    return unauthorized();
  }

  if (!validateCSRF(req)) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const cashflowLimit = await enforceRateLimit(
    req,
    RATE_LIMIT_SCOPES.cashflowCreate,
    { identity: "session" },
  );

  if (cashflowLimit) return cashflowLimit;

  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");
  const body = isMultipart ? await req.formData() : await req.json();

  const type = String(isMultipart ? body.get("type") : body.type || "").trim().toLowerCase();
  const amount = Number(isMultipart ? body.get("amount") : body.amount || 0);
  const rawNote = String(isMultipart ? body.get("note") : body.note || "").trim();
  const receiptFile = isMultipart ? body.get("receipt") : null;

  if (!["income", "expense"].includes(type)) {
    return NextResponse.json(
      {
        error: "Type must be income or expense",
      },
      {
        status: 400,
      },
    );
  }

  if (!Number.isFinite(amount) || amount <= 0 || !rawNote) {
    return NextResponse.json(
      {
        error: "Amount and note are required",
      },
      {
        status: 400,
      },
    );
  }

  const sheets = await getSheets();

  const today = new Date().toISOString().slice(0, 10);

  const cashflowId = generateId("CSFLOW-");
  const refId = generateId("DIRECT-");
  const note = toTitleCase(rawNote);
  let receiptUrl = "";

  if (type === "expense") {
    const uploaded = await uploadCashflowReceipt(receiptFile, { cashflowId });
    receiptUrl = uploaded.url;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Cashflow!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[cashflowId, refId, type, amount, note, today, receiptUrl]],
    },
  });

  await recordAdminActivity(req, {
    type: "create",
    module: "cashflow",
    severity: type === "expense" ? "warning" : "success",
    message: `Record ${type} direct cashflow ${note}`,
    metadata: {
      cashflow_id: cashflowId,
      ref_id: refId,
      type,
      amount,
      note,
      date: today,
      source: "direct",
      receipt_url: receiptUrl,
    },
  });

  return NextResponse.json({ success: true, receipt_url: withMediaReceiptUrl({ receipt_url: receiptUrl }).receipt_url });
}
