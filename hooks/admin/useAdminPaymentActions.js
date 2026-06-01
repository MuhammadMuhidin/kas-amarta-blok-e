"use client";

import { useEffect, useState } from "react";
import { readJson, sendJson } from "@/components/admin/adminClientApi";

function buildBulkPaymentFailureMessage({ period, success, recovered, failures }) {
  const recoveredLines = recovered.length
    ? [
        "",
        "Terdeteksi sudah masuk setelah response error:",
        ...recovered.map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"}: ${item.note}`),
      ]
    : [];

  const failureLines = failures.length
    ? failures.map((item, index) => `${index + 1}. ${item.house || "-"} - ${item.name || "-"}: ${item.error}`).join("\n")
    : "-";

  return [
    "[ADMIN ALERT] Bulk Record Payment perlu pengecekan.",
    "",
    `Periode: ${period || "-"}`,
    `Berhasil: ${success} rumah`,
    `Recovered: ${recovered.length} rumah`,
    `Gagal: ${failures.length} rumah`,
    ...recoveredLines,
    "",
    "Detail gagal:",
    failureLines,
  ].join("\n");
}

async function notifyBulkPaymentFailures({ period, success, recovered, failures }) {
  if (!failures.length && !recovered.length) return;

  await sendJson("/api/waha/workflow", "POST", {
    period,
    source: "admin-bulk-payment-failure",
    message: buildBulkPaymentFailureMessage({ period, success, recovered, failures }),
  });
}

async function findRecordedPayment({ person, period, normalize }) {
  const latestPayments = await readJson("/api/sheets/payment");

  return latestPayments.find((item) => {
    const samePeriod = normalize(item.period).slice(0, 7) === normalize(period).slice(0, 7);
    const samePerson = normalize(item.person_id) === normalize(person.id);
    const sameHouse = normalize(item.person_house) === normalize(person.house);

    return samePeriod && (samePerson || sameHouse);
  });
}

async function ensureTrashPayment({ person, paymentId, appConfig, createTrashPayment }) {
  if ((person.trash || "").toUpperCase() !== "Y") {
    return "Payment ditemukan setelah response error.";
  }

  const trashRecords = await readJson("/api/sheets/trash");
  const alreadyRecorded = trashRecords.some((item) => String(item.payment_id || "").trim() === String(paymentId || "").trim());

  if (alreadyRecorded) {
    return "Payment dan trash ditemukan setelah response error.";
  }

  await createTrashPayment({
    payment_id: paymentId,
    person_id: person.id,
    house: person.house,
    name: person.name,
    amount: appConfig.trash_fee,
    source: "payment-recovery",
  });

  return "Payment ditemukan setelah response error, trash berhasil dilengkapi.";
}

export default function useAdminPaymentActions({
  personal,
  payments,
  appConfig,
  payment,
  setPayment,
  loadPayment,
  loadTrash,
  loadCashflow,
  showPopup,
  createPayment,
  createTrashPayment,
  normalize,
}) {
  const [selected, setSelected] = useState([]);
  const [loadingPayment, setLoadingPayment] = useState(false);

  function isHousePaidForPeriod(person) {
    const period = normalize(payment.period);
    if (!period) return false;

    return payments.some((item) => {
      const samePeriod = normalize(item.period) === period;
      const samePerson = normalize(item.person_id) === normalize(person.id);
      const sameHouse = normalize(item.person_house) === normalize(person.house);
      return samePeriod && (samePerson || sameHouse);
    });
  }

  function toggleHouse(id) {
    const person = personal.find((item) => item.id === id);
    if (!person || isHousePaidForPeriod(person)) return;

    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function recordPayment(e) {
    e.preventDefault();

    if (!appConfig) {
      showPopup("Konfigurasi kas belum tersedia. Pembayaran tidak bisa dicatat.", "error");
      return;
    }

    if (!payment.period) {
      showPopup("Masukkan periode pembayaran terlebih dahulu", "error");
      return;
    }

    if (selected.length === 0) {
      showPopup("Pilih minimal 1 rumah yang belum dibayar", "error");
      return;
    }

    setLoadingPayment(true);

    try {
      let success = 0;
      const recovered = [];
      const failures = [];

      for (const id of selected) {
        const person = personal.find((item) => item.id === id);
        if (!person) continue;

        try {
          const paymentData = await createPayment({
            house: person.house,
            period: payment.period,
            amount: payment.amount,
          });

          if ((person.trash || "").toUpperCase() === "Y") {
            await createTrashPayment({
              payment_id: paymentData.payment_id,
              person_id: person.id,
              house: person.house,
              name: person.name,
              period: payment.period,
              amount: appConfig.trash_fee,
              source: "payment",
            });
          }

          success += 1;
        } catch (err) {
          try {
            const recordedPayment = await findRecordedPayment({ person, period: payment.period, normalize });

            if (recordedPayment?.id) {
              const note = await ensureTrashPayment({
                person,
                paymentId: recordedPayment.id,
                appConfig,
                createTrashPayment,
              });

              success += 1;
              recovered.push({
                id: person.id,
                house: person.house,
                name: person.name,
                note,
              });
              continue;
            }
          } catch (verifyErr) {
            failures.push({
              id: person.id,
              house: person.house,
              name: person.name,
              error: `${err.message || "Gagal mencatat pembayaran"}. Verifikasi gagal: ${verifyErr.message || "unknown"}`,
            });
            continue;
          }

          failures.push({
            id: person.id,
            house: person.house,
            name: person.name,
            error: err.message || "Gagal mencatat pembayaran",
          });
        }
      }

      await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);

      if (failures.length > 0 || recovered.length > 0) {
        try {
          await notifyBulkPaymentFailures({ period: payment.period, success, recovered, failures });
        } catch (notifyErr) {
          showPopup(notifyErr.message || "Gagal trigger WhatsApp workflow", "error");
        }
      }

      if (success > 0) {
        setSelected((prev) => prev.filter((id) => failures.some((item) => item.id === id)));
      }

      if (failures.length === 0) {
        const recoveredText = recovered.length ? ` (${recovered.length} hasil recovery)` : "";
        showPopup(`Pembayaran berhasil dicatat untuk ${success} rumah${recoveredText}`, "success");
        setSelected([]);
        setPayment({ period: "", amount: appConfig.monthly_fee });
      } else if (success > 0) {
        showPopup(`Pembayaran sebagian berhasil: ${success} sukses, ${failures.length} gagal`, "warning");
      } else {
        showPopup(`Semua pembayaran gagal dicatat untuk ${failures.length} rumah`, "error");
      }
    } finally {
      setLoadingPayment(false);
    }
  }

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => {
      const person = personal.find((item) => item.id === id);
      return person && !isHousePaidForPeriod(person);
    }));
  }, [payment.period, payments, personal]);

  return {
    selected,
    loadingPayment,
    toggleHouse,
    isHousePaidForPeriod,
    recordPayment,
  };
}
