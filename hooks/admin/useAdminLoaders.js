"use client";

import { useEffect, useRef, useState } from "react";
import { readJson } from "@/components/admin/adminClientApi";

const CACHE_MS = 30000;

export default function useAdminLoaders({ setPayment }) {
  const [personal, setPersonal] = useState([]);
  const [payments, setPayments] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [cashflows, setCashflows] = useState([]);
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState("");
  const requests = useRef({});
  const ids = useRef({});
  const monitor = useRef({ loadedAt: 0, promise: null, generation: 0 });

  function begin(name) {
    requests.current[name]?.abort();
    const controller = new AbortController();
    const id = Number(ids.current[name] || 0) + 1;
    requests.current[name] = controller;
    ids.current[name] = id;
    return { controller, id };
  }

  function current(name, controller, id) {
    return !controller.signal.aborted && requests.current[name] === controller && ids.current[name] === id;
  }

  async function load(name, path, setter) {
    const { controller, id } = begin(name);
    try {
      const data = await readJson(path, { signal: controller.signal });
      if (current(name, controller, id)) setter(data);
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      throw error;
    } finally {
      if (requests.current[name] === controller) delete requests.current[name];
    }
  }

  async function loadAppConfig() {
    const { controller, id } = begin("appConfig");
    try {
      setConfigError("");
      const data = await readJson("/api/admin/settings/app", { signal: controller.signal });
      if (!current("appConfig", controller, id)) return data;
      setAppConfig(data.config);
      setPayment((value) => ({ ...value, amount: data.config.monthly_fee }));
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      if (current("appConfig", controller, id)) {
        setAppConfig(null);
        setConfigError(error.message || "Failed to load configuration");
      }
      throw error;
    } finally {
      if (requests.current.appConfig === controller) delete requests.current.appConfig;
    }
  }

  const loadPersonal = () => load("personal", "/api/sheets/personal", setPersonal);
  const loadPayment = () => load("payment", "/api/sheets/payment", setPayments);
  const loadTrash = () => load("trash", "/api/sheets/trash", setTrashRecords);
  const loadDeposit = () => load("deposit", "/api/sheets/deposit", setDeposits);
  const loadCashflow = () => load("cashflow", "/api/sheets/cashflow", setCashflows);

  async function refreshMonitoring({ force = false } = {}) {
    if (!force && Date.now() - monitor.current.loadedAt < CACHE_MS) return true;
    if (monitor.current.promise) return monitor.current.promise;
    const generation = monitor.current.generation + 1;
    monitor.current.generation = generation;
    setMonitoringLoading(true);
    setMonitoringError("");
    monitor.current.promise = Promise.all([
      loadAppConfig(), loadPayment(), loadTrash(), loadPersonal(), loadCashflow(), loadDeposit(),
    ]).then(() => {
      if (monitor.current.generation === generation) monitor.current.loadedAt = Date.now();
      return true;
    }).catch((error) => {
      if (monitor.current.generation === generation && error?.name !== "AbortError") {
        setMonitoringError(error.message || "Failed to load monitoring datasets");
      }
      return false;
    }).finally(() => {
      if (monitor.current.generation === generation) setMonitoringLoading(false);
      monitor.current.promise = null;
    });
    return monitor.current.promise;
  }

  function refreshTabData(tab, options = {}) {
    if (tab === "overview" || tab === "monitoring") return refreshMonitoring(options);
    if (tab === "personal") return loadPersonal();
    if (tab === "payment") return Promise.all([loadAppConfig(), loadPersonal(), loadPayment()]);
    if (tab === "deposit") return Promise.all([
      loadAppConfig(), loadPersonal(), loadDeposit(), loadPayment(), loadTrash(), loadCashflow(),
    ]);
    if (tab === "settings") return loadAppConfig();
    return undefined;
  }

  useEffect(() => () => {
    Object.values(requests.current).forEach((controller) => controller?.abort());
    monitor.current.generation += 1;
  }, []);

  return {
    personal, setPersonal, payments, trashRecords, deposits, cashflows, appConfig, configError,
    monitoringLoading, monitoringError, loadAppConfig, loadPersonal, loadPayment, loadTrash,
    loadDeposit, loadCashflow, refreshMonitoring, refreshTabData,
  };
}
