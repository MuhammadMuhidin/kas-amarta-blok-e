"use client";

import { useCallback, useEffect, useState } from "react";

const initialSummary = {
  payments: [],
  cashflows: [],
  persons: [],
  periods: [],
  payment_confirmations: [],
};

export default function usePublicSummary(fetchUrl = "/api/sheets/summary") {
  const [data, setData] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const res = await fetch(`${fetchUrl}?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load data");

      const json = await res.json();
      setData(json || initialSummary);

      if (json?.periods?.length > 0) {
        setSelectedPeriod((current) => current || [...json.periods].sort().pop());
      }
    } catch (err) {
      setError(err.message || "Gagal memuat data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!active) return;
      await load();
    }

    run();

    return () => {
      active = false;
    };
  }, [load]);

  return {
    data,
    insight: data.insight || {},
    loading,
    error,
    selectedPeriod,
    setSelectedPeriod,
    reload: () => load({ silent: true }),
  };
}
