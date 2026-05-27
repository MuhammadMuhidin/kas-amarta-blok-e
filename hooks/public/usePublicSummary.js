"use client";

import { useEffect, useState } from "react";

const initialSummary = {
  payments: [],
  cashflows: [],
  persons: [],
  periods: [],
};

export default function usePublicSummary(fetchUrl = "/api/sheets/summary") {
  const [data, setData] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${fetchUrl}?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to load data");

        const json = await res.json();

        if (!active) return;

        setData(json || initialSummary);

        if (json?.periods?.length > 0) {
          setSelectedPeriod([...json.periods].sort().pop());
        }
      } catch (err) {
        if (active) setError(err.message || "Gagal memuat data");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [fetchUrl]);

  return {
    data,
    insight: data.insight || {},
    loading,
    error,
    selectedPeriod,
    setSelectedPeriod,
  };
}
