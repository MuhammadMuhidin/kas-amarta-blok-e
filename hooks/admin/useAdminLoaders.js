"use client";

import { useEffect, useRef, useState } from "react";
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
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState("");

  const controllers = useRef({});
  const requestIds = useRef({});
  const lastMonitoringLoadAt = useRef(0);
  const monitoringPromise = useRef(null);
  const monitoringGeneration = useRef(0);

  function nextRequest(name) {
    controllers.current[name]?.abort();
    const controller = new AbortController();
    const requestId = Number(requestIds.current[name] || 0) + 1;
    controllers.current[name] = controller;
    requestIds.current[name] = requestId;
    return { controller, requestId };
  }

  function isCurrent(name, controller, requestId) {
    return !controller.signal.aborted
      && controllers.current[name] === controller
      && requestIds.current[name] === requestId;
  }

  async function loadResource(name, path, setter) {
    const { controller, requestId } = nextRequest(name);

    try {
      const data = await readJson(path, { signal: controller.signal });
      if (isCurrent(name, controller, requestId)) setter(data);
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      throw error;
    } finally {
      if (controllers.current[name] === controller) {
        delete controllers.current[name];
      }
    }
  }

  async function loadAppConfig() {
    const { controller, requestId } = nextRequest("appConfig");

    try {
      if (isCurrent("appConfig", controller, requestId)) setConfigError("");
      const data = await readJson("/api/admin/settings/app", { signal: controller.signal });
      if (!isCurrent("appConfig", controller, requestId)) return data;
      setAppConfig(data.config);
      setPayment((prev) => ({ ...prev, amount: data.config.monthly_fee }));
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      if (isCurrent("appConfig", controller, requestId)) {
        setAppConfig(null);
        setConfigError(error.message || "Failed to load configuration");
      }
      throw error;
    } finally {
      if (controllers.current.appConfig === controller) {
        delete controllers.current.appConfig;
      }
    }
  }

  function loadPersonal() {
    return loadResource("personal", "/api/sheets/personal", setPersonal);
  }

  function loadPayment() {
    return loadResource("payment", "/api/sheets/payment", setPayments);
  }

  function loadTrash() {
    return loadResource("trash", "/api/sheets/trash", setTrashRecords);
  }

  function loadDeposit() {
    return loadResource("deposit", "/api/sheets/deposit", setDeposits);
  }

  function loadCashflow() {
    return loadResource("cashflow", "/api/sheets/cashflow", setCashflows);
  }

  async function refreshMonitoring({ force = false } = {}) {
    const fresh = Date.now() - lastMonitoringLoadAt.current < MONITORING_CACHE_MS;
    if (!force && fresh) return true;
    if (monitoringPromise.current) return monitoringPromise.current;

    const generation = monitoringGeneration.current + 1;
    monitoringGeneration.current = generation;
    setMonitoringLoading(true);
    setMonitoringError("");

    monitoringPromise.current = Promise.all([
      loadAppConfig(),
      loadPayment(),
      loadTrash(),
      loadPersonal(),
      loadCashflow(),
      loadDeposit(),
    ])
      .then(() => {
        if (monitoringGeneration.current === generation) {
          lastMonitoringLoadAt.current = Date.now();
        }
        return true;
      })
      .catch((error) => {
        if (monitoringGeneration.current === generation && error?.name !== "AbortError") {
          setMonitoringError(error.message || "Failed to load monitoring datasets");
        }
        return false;
      })
      .finally(() => {
        if (monitoringGeneration.current === generation) {
          setMonitoringLoading(false);
        }
        monitoringPromise.current = null;
      });

    return monitoringPromise.current;
  }

  async function refreshTabData(nextTab, options = {}) {
    if (nextTab === "overview") return refreshMonitoring(options);
    if (nextTab === "personal") return undefined;
    if (nextTab === "payment") {
      return Promise.all([loadAppConfig(), loadPersonal(), loadPayment()]);
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
    if (nextTab === "cashflow") return undefined;
    if (nextTab === "monitoring") return refreshMonitoring(options);
    if (nextTab === "settings") return loadAppConfig();
    return undefined;
  }

  useEffect(() => () => {
    Object.values(controllers.current).forEach((controller) => controller?.abort());
    monitoringGeneration.current += 1;
  }, []);

  return {
    personal,
    setPersonal,
    payments,
    trashRecords,
    deposits,
    cashflows,
    appConfig,
    configError,
    monitoringLoading,
    monitoringError,
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
