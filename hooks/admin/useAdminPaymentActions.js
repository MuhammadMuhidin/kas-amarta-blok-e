"use client";

import { useEffect, useState } from "react";

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

      for (const id of selected) {
        const person = personal.find((item) => item.id === id);
        if (!person) continue;

        const paymentData = await createPayment({
          house: person.house,
          period: payment.period,
          amount: payment.amount,
        });

        success += 1;

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
      }

      showPopup(`Pembayaran berhasil dicatat untuk ${success} rumah`, "success");
      setSelected([]);
      setPayment({ period: "", amount: appConfig.monthly_fee });
      await Promise.all([loadPayment(), loadTrash(), loadCashflow()]);
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
