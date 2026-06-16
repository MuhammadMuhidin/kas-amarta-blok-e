"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useRef, useState } from "react";

function MetricCard({ value, label }) {
  return (
    <div className="admin-summary-card" style={styles.metricCard}>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

export default function RoleSecurityOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    readJson("/api/admin/role-management", { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError" && !controller.signal.aborted && requestRef.current === controller) {
          setData(null);
          setError(err.message || "Failed to load role security overview");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const cards = data?.cards || {};
  const health = cards.security_health || {};
  const roles = data?.roles || [];

  return (
    <div id="role-security-panel" role="tabpanel" className="admin-card">
      <div style={styles.header}>
        <div>
          <h3 style={{ margin: 0 }}>Security Overview</h3>
          <p style={styles.muted}>Loaded only while this subtab is active.</p>
        </div>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      {loading ? (
        <AdminDataSkeleton cards={4} rows={4} />
      ) : (
        <>
          <div className="admin-summary-cards" style={styles.summaryGrid}>
            <MetricCard value={roles.length} label="Roles" />
            <MetricCard
              value={`${health.contact_ready_count || 0}/${health.contact_total || 0}`}
              label="OTP Contacts"
            />
            <MetricCard value={cards.active_sessions?.length || 0} label="Active Sessions" />
            <MetricCard value={health.overall_status || "-"} label="Health" />
          </div>

          {health.warnings?.length ? (
            <div className="admin-error-box">
              {health.warnings.map((warning) => <div key={warning}>• {warning}</div>)}
            </div>
          ) : (
            <div className="admin-empty-state">No role security warnings.</div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  muted: {
    margin: "4px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },
  summaryGrid: {
    marginBottom: 14,
  },
  metricCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
    textAlign: "center",
  },
  metricValue: {
    lineHeight: 1.2,
  },
  metricLabel: {
    lineHeight: 1.2,
  },
};
