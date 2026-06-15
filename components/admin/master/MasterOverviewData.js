"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useMemo, useRef, useState } from "react";

export default function MasterOverviewData() {
  const [rows, setRows] = useState([]);
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

    readJson("/api/admin/approval-masters", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setRows(Array.isArray(data?.masters) ? data.masters : []);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError" && !controller.signal.aborted && requestRef.current === controller) {
          setRows([]);
          setError(err.message || "Failed to load master overview");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

  const counts = useMemo(() => ({
    active: rows.filter((row) => row.lifecycle_status === "active").length,
    draft: rows.filter((row) => row.lifecycle_status === "draft" || row.has_draft).length,
    archived: rows.filter((row) => row.lifecycle_status === "archived").length,
  }), [rows]);

  return (
    <div id="master-overview-panel" role="tabpanel" className="admin-card">
      <div style={styles.header}>
        <div><h3 style={{ margin: 0 }}>Lifecycle Overview</h3><p style={styles.muted}>Loaded only while this subtab is active.</p></div>
        <button type="button" className="admin-small-btn" disabled={loading} onClick={() => setVersion((value) => value + 1)}>Refresh</button>
      </div>
      {error && <div className="admin-error-box">{error}</div>}
      {loading ? <AdminDataSkeleton cards={4} rows={3} /> : (
        <>
          <div className="admin-summary-cards" style={{ marginBottom: 14 }}>
            <div className="admin-summary-card"><strong>{rows.length}</strong><span>Total</span></div>
            <div className="admin-summary-card"><strong>{counts.active}</strong><span>Active</span></div>
            <div className="admin-summary-card"><strong>{counts.draft}</strong><span>Draft</span></div>
            <div className="admin-summary-card"><strong>{counts.archived}</strong><span>Archived</span></div>
          </div>
          <div style={styles.list}>
            {rows.map((row) => <div key={row.id} style={styles.item}><div><strong>{row.name || row.code}</strong><div style={styles.muted}>{row.code || "-"} · {(row.fields_schema || []).length} fields · {(row.flow_schema || []).length} steps</div></div><span style={styles.badge}>{row.lifecycle_status || "draft"}</span></div>)}
            {!rows.length && <div className="admin-empty-state">No approval master found.</div>}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  muted: { margin: "4px 0 0", color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.5 },
  list: { display: "grid", gap: 8 },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, border: "1px solid var(--admin-border)", borderRadius: 12, background: "var(--admin-row)" },
  badge: { padding: "5px 9px", borderRadius: 999, background: "var(--admin-card)", color: "var(--admin-text)", fontSize: 11, fontWeight: 900, textTransform: "capitalize" },
};
