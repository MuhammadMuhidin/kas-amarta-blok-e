"use client";

import { useRef, useState } from "react";
import { readJson } from "@/components/admin/adminClientApi";

const MONITORING_CACHE_MS = 30 * 1000;

export default function useAdminLoaders({ setPayment }) {
  const [personal, setPersonal] = useState([]);
  const [payments, setPayments] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [cashflows, setCashflows] = useState([]);
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const lastMonitoringLoadAt = useRef(0);
  const monitoringPromise = useRef(null);

  async function loadAppConfig() {
    try {
      setConfigError("");
      const data = await readJson("/api/admin/settings/app");
      setAppConfig(data.config);
      setPayment((prev) => ({ ...prev, amount: data.config.monthly_fee }));
    } catch (err) {
      setAppConfig(null);
      setConfigError(err.message || "Failed to load configuration");
    }
  }

  async function loadPersonal() {
    setPersonal(await readJson("/api/sheets/personal"));
  }

  async function loadPayment() {
    setPayments(await readJson("/api/sheets/payment"));
  }

  async function loadTrash() {
    setTrashRecords(await readJson("/api/sheets/trash"));
  }

  async function loadDeposit() {
    setDeposits(await readJson("/api/sheets/deposit"));
  }

  async function loadCashflow() {
    setCashflows(await readJson("/api/sheets/cashflow"));
  }

  async function refreshMonitoring({ force = false } = {}) {
    const fresh = Date.now() - lastMonitoringLoadAt.current < MONITORING_CACHE_MS;
    if (!force && fresh) return;
    if (monitoringPromise.current) return monitoringPromise.current;

    monitoringPromise.current = Promise.all([
      loadAppConfig(),
      loadPayment(),
      loadTrash(),
      loadPersonal(),
      loadCashflow(),
      loadDeposit(),
    ]).then(() => {
      lastMonitoringLoadAt.current = Date.now();
    }).finally(() => {
      monitoringPromise.current = null;
    });

    return monitoringPromise.current;
  }

  async function refreshTabData(nextTab, options = {}) {
    if (nextTab === "overview") return refreshMonitoring(options);
    if (nextTab === "personal") return loadPersonal();
    if (nextTab === "payment") {
      return Promise.all([loadAppConfig(), loadPersonal(), loadPayment(), loadDeposit()]);
    }
    if (nextTab === "deposit") {
      return Promise.all([
        loadAppConfig(),
        loadPersonal(),
        loadDeposit(),
        loadPayment(),
        loadTrash(),
        loadCashflow(),
      ]);
    }
    if (nextTab === "cashflow") return loadCashflow();
    if (nextTab === "monitoring") return refreshMonitoring(options);
    if (nextTab === "settings") return loadAppConfig();
  }

  return {
    personal,
    setPersonal,
    payments,
    trashRecords,
    deposits,
    cashflows,
    appConfig,
    configError,
    loadAppConfig,
    loadPersonal,
    loadPayment,
    loadTrash,
    loadDeposit,
    loadCashflow,
    refreshMonitoring,
    refreshTabData,
  };
}
