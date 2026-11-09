import { useMemo, useState, useEffect } from "react";
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

async function fetchPaymentProof(paymentId) {
  if (!paymentId) return null;
  try {
    const res = await fetch(`/api/public/payment-proof?payment_id=${encodeURIComponent(paymentId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data.proof : null;
  } catch {
    return null;
  }
}

export function usePaymentReceipt({ resident, selectedPeriod, payments, paymentConfirmations, appConfig }) {
  const [proofData, setProofData] = useState(null);

  // Fetch proof when payment ID is available
  useEffect(() => {
    const periodKey = selectedPeriod?.slice(0, 7);
    const confirmation = paymentConfirmations?.find(
      (c) =>
        normalize(c.person_id) === normalize(resident?.id) &&
        normalize(c.period || "").slice(0, 7) === periodKey
    );
    const paymentId = confirmation?.approved_payment_id;

    if (paymentId) {
      fetchPaymentProof(paymentId).then((proof) => {
        setProofData(proof);
      });
    }
  }, [resident, selectedPeriod, paymentConfirmations]);

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

    // Nominal sampah: berdasarkan resident.trash field
    const isTrashUser = normalize(resident.trash).toUpperCase() === "Y";
    const trashAmount = isTrashUser ? Number(config.trash_fee || 0) : 0;

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

    // Payment ID & Receipt No
    const paymentId = payment?.id || confirmation?.approved_payment_id || "";
    const receiptNo = paymentId
      ? `KWT-${paymentId.slice(-6).toUpperCase()}-${periodKey.replace("-", "")}`
      : "";

    // Proof data (from API)
    const proofId = proofData?.id || "";
    const proofFilename = proofData?.original_filename || "";
    const proofSubmittedAt = proofData?.submitted_at
      ? formatDateTimeIndo(proofData.submitted_at)
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
      paymentId,
      receiptNo,
      proofId,
      proofFilename,
      proofSubmittedAt,
      fileName: `kwitansi-${resident.house}-${periodKey}.jpg`,
    };
  }, [resident, selectedPeriod, payments, paymentConfirmations, appConfig, proofData]);

  return receiptData;
}