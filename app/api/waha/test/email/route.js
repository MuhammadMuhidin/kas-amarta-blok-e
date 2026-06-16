import { NextResponse } from "next/server";
import { isAdmin, unauthorized, validateCSRF } from "@/lib/auth";
import { sendAlertEmail } from "@/lib/emailAlert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatPeriod(value) {
  const normalized = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) return normalized || "-";
  const month = MONTH_NAMES[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : normalized;
}

export async function POST(req) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const period = String(body.period || "-").trim();
    const periodLabel = formatPeriod(period);
    const result = await sendAlertEmail({
      source: "admin-test-alert",
      period,
      subject: `[Amarta Kas] Uji Notifikasi Sistem - ${periodLabel}`,
      message: [
        "Uji Notifikasi Sistem",
        "",
        "Status: Berhasil",
        "Keterangan: Permintaan uji notifikasi email dari menu Monitoring berhasil diproses.",
        `Periode: ${periodLabel}`,
        "Sumber: Aplikasi",
      ].join("\n"),
    });

    return NextResponse.json({ ok: Boolean(result?.ok), email: result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mengirim email test" },
      { status: 500 },
    );
  }
}
