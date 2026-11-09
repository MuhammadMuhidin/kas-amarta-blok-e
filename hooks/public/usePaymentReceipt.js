import { useMemo } from "react";
import { formatPeriod } from "@/lib/public/publicFormatters";

function normalize(value) {
  return String(value || "").trim();
}

function formatDateIndo(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatDateTimeIndo(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

export function usePaymentReceipt({ resident, selectedPeriod, payments, paymentConfirmations, appConfig }) {
  const receiptData = useMemo(() => {
    if (!resident || !resident.paid || !selectedPeriod) return null;

    const periodKey = selectedPeriod.slice(0, 7);
    const confirmations = paymentConfirmations || [];
    const config = appConfig || {};

    // Cari payment record untuk rumah & periode ini
    const payment = payments.find(
      (p) =>
        normalize(p.person_id) === normalize(resident.id) &&
        normalize(p.period || "").slice(0, 7) === periodKey
    );

    // Cari confirmation record
    const confirmation = confirmations.find(
      (c) =>
        normalize(c.person_id) === normalize(resident.id) &&
        normalize(c.period || "").slice(0, 7) === periodKey
    );

    if (!payment && !confirmation) return null;

    // Nominal kas dari payment atau config
    const cashAmount = payment ? Number(payment.amount || 0) : Number(config.monthly_fee || 0);

    // Nominal sampah: dari trashAmount di confirmation/payment_proofs, atau hitung dari config
    // Karena di public tidak ada akses ke payment_proofs, pakai heuristic:
    // jika resident.trash === 'Y' → pakai trash_fee dari config
    const trashAmount = normalize(resident.trash).toUpperCase() === "Y"
      ? Number(config.trash_fee || 0)
      : 0;

    const totalAmount = cashAmount + trashAmount;

    // Tanggal bayar: dari payment.date atau confirmation.reviewed_at
    const paymentDate = payment?.date || confirmation?.reviewed_at || "";

    // Approved by/at dari confirmation
    const approvedBy = confirmation?.reviewed_by || "admin";
    const approvedAt = confirmation?.reviewed_at
      ? formatDateTimeIndo(confirmation.reviewed_at)
      : paymentDate
        ? formatDateTimeIndo(paymentDate)
        : "";

    return {
      period: periodKey,
      house: resident.house,
      paymentDate: paymentDate ? formatDateIndo(paymentDate) : "",
      cashAmount,
      trashAmount,
      totalAmount,
      approvedBy,
      approvedAt,
      fileName: `kwitansi-${resident.house}-${periodKey}.jpg`,
    };
  }, [resident, selectedPeriod, payments, paymentConfirmations, appConfig]);

  return receiptData;
}