"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useRef, useState } from "react";

export default function RoleSecurityOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const requestRef = useRef(null);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    readJson("/api/admin/role-management", { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted && requestRef.current === controller) setData(payload);
      })
      .catch((err) => {
        if (err?.name !== "AbortError" && !controller.signal.aborted && requestRef.current === controller) {
          setData(null);
          setError(err.message || "Failed to load role security overview");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

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
        <button type="button" className="admin-small-btn" disabled={loading} onClick={() => setVersion((value) => value + 1)}>
          Refresh
        </button>
      </div>
      {error && <div className="admin-error-box">{error}</div>}
      {loading ? <AdminDataSkeleton cards={4} rows={4} /> : (
        <>
          <div className="admin-summary-cards" style={{ marginBottom: 14 }}>
            <div className="admin-summary-card"><strong>{roles.length}</strong><span>Roles</span></div>
            <div className="admin-summary-card"><strong>{health.contact_ready_count || 0}/{health.contact_total || 0}</strong><span>OTP Contacts</span></div>
            <div className="admin-summary-card"><strong>{cards.active_sessions?.length || 0}</strong><span>Active Sessions</span></div>
            <div className="admin-summary-card"><strong>{health.overall_status || "-"}</strong><span>Health</span></div>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  muted: { margin: "4px 0 0", color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.5 },
};
