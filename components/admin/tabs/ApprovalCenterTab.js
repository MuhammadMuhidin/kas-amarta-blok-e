"use client";

import Toast from "@/components/Toast";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useMemo, useState } from "react";

const APPROVAL_REQUESTS_API = "/api/admin/approval-requests";

const approvalCenterCss = `
  body.admin-approval-center-page,
  body.admin-approval-center-page .admin-wrapper,
  .approval-center-card,
  .approval-center-card .admin-status-card,
  .approval-center-card .admin-table-wrapper {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: visible !important;
  }

  .approval-center-card,
  .approval-center-section,
  .approval-center-table-wrapper {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  .approval-center-card .admin-table-wrapper {
    overflow-x: auto !important;
  }

  @media (max-width: 640px) {
    .approval-center-card {
      padding: 14px !important;
      overflow-x: hidden !important;
    }

    .approval-center-table-wrapper {
      overflow-x: hidden !important;
    }

    .approval-center-table {
      width: 100% !important;
      min-width: 0 !important;
      border-collapse: separate !important;
      border-spacing: 0 10px !important;
    }

    .approval-center-table thead {
      display: none !important;
    }

    .approval-center-table tbody,
    .approval-center-table tr,
    .approval-center-table td {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    .approval-center-table tr {
      padding: 12px !important;
      border: 1px solid var(--admin-border) !important;
      border-radius: 14px !important;
      background: var(--admin-card) !important;
    }

    .approval-center-table .admin-td {
      padding: 7px 0 !important;
      border-bottom: 1px solid var(--admin-border) !important;
      text-align: left !important;
      white-space: normal !important;
      word-break: break-word !important;
    }

    .approval-center-table .admin-td:last-child {
      border-bottom: 0 !important;
      padding-bottom: 0 !important;
    }

    .approval-center-cell-label {
      display: block !important;
      margin-bottom: 3px !important;
      color: var(--admin-muted) !important;
      font-size: 11px !important;
      font-weight: 900 !important;
      letter-spacing: 0.04em !important;
      text-transform: uppercase !important;
    }

    .approval-center-actions {
      justify-content: flex-start !important;
    }
  }
`;

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function getStatusClass(status) {
  if (["completed", "paid"].includes(status)) return "admin-deposit-status-paid";
  if (["rejected", "cancelled"].includes(status)) return "admin-deposit-status-missed";
  if (["waiting_payment_validation", "waiting_approval", "submitted"].includes(status)) return "admin-deposit-status-pending";
  return "admin-deposit-status-waiting";
}

function StatusBadge({ status }) {
  return <span className={`admin-deposit-status ${getStatusClass(status)}`}>{status || "-"}</span>;
}

function Cell({ label, children }) {
  return <td className="admin-td"><span className="approval-center-cell-label">{label}</span>{children}</td>;
}

export default function ApprovalCenterTab() {
  const [data, setData] = useState({ summary: {}, inbox: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState("");
  const [toast, setToast] = useState(null);

  const visibleRequests = useMemo(() => {
    const inboxIds = new Set((data.inbox || []).map((row) => row.id));
    return (data.requests || []).filter((row) => !inboxIds.has(row.id));
  }, [data.inbox, data.requests]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    try {
      setLoading(true);
      setData(await readJson(APPROVAL_REQUESTS_API));
    } catch (err) {
      showToast(err.message || "Gagal membaca Approval Center", "error");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(row, action) {
    const note = window.prompt(action === "reject" ? "Catatan penolakan" : "Catatan approval (opsional)", "");
    if (note === null) return;

    try {
      setRunningId(`${row.id}-${action}`);
      await sendJson(APPROVAL_REQUESTS_API, "PATCH", { id: row.id, action, note });
      showToast(action === "reject" ? "Pengajuan ditolak" : "Pengajuan diproses");
      await loadData();
    } catch (err) {
      showToast(err.message || "Gagal memproses approval", "error");
    } finally {
      setRunningId("");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    document.body.classList.add("admin-approval-center-page");
    return () => document.body.classList.remove("admin-approval-center-page");
  }, []);

  if (loading) return <div className="admin-card">Loading Approval Center...</div>;

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <style jsx global>{approvalCenterCss}</style>
      <div className="admin-card approval-center-card" style={styles.card}>
        <div className="activity-header" style={styles.header}>
          <div>
            <div className="activity-kicker">Approval Workflow</div>
            <h3 className="activity-title">Approval Center</h3>
            <p className="activity-subtitle">Inbox pengurus untuk validasi pembayaran, approve, reject, dan monitoring pengajuan warga.</p>
          </div>
        </div>

        <div className="admin-summary-cards" style={styles.summaryCards}>
          <SummaryCard label="Inbox Saya" value={data.summary?.inbox || 0} />
          <SummaryCard label="Sedang Proses" value={data.summary?.processing || 0} />
          <SummaryCard label="Selesai" value={data.summary?.completed || 0} />
          <SummaryCard label="Ditolak" value={data.summary?.rejected || 0} />
        </div>

        <div style={styles.sections}>
          <Section title="Inbox Saya" description="Pengajuan yang sedang menunggu role kamu." compact={!data.inbox?.length}>
            <RequestTable rows={data.inbox || []} runningId={runningId} onAction={runAction} showActions />
          </Section>

          {visibleRequests.length > 0 ? (
            <Section title="Pengajuan Terbaru" description="Daftar pengajuan terbaru untuk monitoring.">
              <RequestTable rows={visibleRequests} runningId={runningId} onAction={runAction} />
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value }) {
  return <div className="admin-summary-card" style={styles.summaryCard}><div className="admin-status-label">{label}</div><div className="admin-status-value" style={{ marginBottom: 0 }}>{value}</div></div>;
}

function Section({ title, description, compact = false, children }) {
  return <section className="admin-status-card approval-center-section" style={compact ? styles.compactSection : styles.section}><div className="admin-status-label">{title}</div>{description && <div className="admin-status-meta" style={styles.sectionDescription}>{description}</div>}{children}</section>;
}

function RequestTable({ rows, runningId, onAction, showActions = false }) {
  if (!rows.length) return <div className="admin-empty-state" style={styles.emptyState}>Tidak ada pengajuan.</div>;

  return (
    <div className="admin-table-wrapper approval-center-table-wrapper" style={styles.tableWrapper}>
      <table className="admin-table approval-center-table">
        <thead>
          <tr>
            <th className="admin-th">No</th>
            <th className="admin-th">Jenis</th>
            <th className="admin-th">Pemohon</th>
            <th className="admin-th">Status</th>
            <th className="admin-th">Approver</th>
            <th className="admin-th">Amount</th>
            <th className="admin-th">Tanggal</th>
            {showActions && <th className="admin-th">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={index % 2 ? "admin-row-alt" : ""}>
              <Cell label="No">{row.request_no}</Cell>
              <Cell label="Jenis">{row.master_name}</Cell>
              <Cell label="Pemohon">{row.requester_name || "-"}<div className="activity-muted">{row.requester_house || "-"}</div></Cell>
              <Cell label="Status"><StatusBadge status={row.status} /></Cell>
              <Cell label="Approver">{row.current_approver_role || "-"}</Cell>
              <Cell label="Amount">{row.amount ? money(row.amount) : "-"}</Cell>
              <Cell label="Tanggal">{formatTime(row.created_at)}</Cell>
              {showActions && <Cell label="Action"><div className="approval-center-actions" style={styles.actions}><button type="button" className="admin-small-btn" disabled={!!runningId} onClick={() => onAction(row, row.status === "waiting_payment_validation" ? "validate_payment" : "approve")}>{runningId === `${row.id}-approve` ? "Processing..." : row.status === "waiting_payment_validation" ? "Validasi" : "Approve"}</button><button type="button" className="admin-small-btn" disabled={!!runningId} onClick={() => onAction(row, "reject")}>Reject</button></div></Cell>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  card: { height: "auto", minHeight: 0, maxHeight: "none", overflow: "visible" },
  header: { marginBottom: 14 },
  summaryCards: { marginBottom: 0 },
  summaryCard: { cursor: "default" },
  sections: { display: "grid", gap: 12, marginTop: 14, height: "auto", minHeight: 0, maxHeight: "none", overflow: "visible" },
  section: { margin: 0, height: "auto", minHeight: 0, maxHeight: "none", overflow: "visible" },
  compactSection: { margin: 0, padding: 14, height: "auto", minHeight: 0, maxHeight: "none", overflow: "visible" },
  sectionDescription: { marginBottom: 10 },
  tableWrapper: { overflowX: "auto", overflowY: "visible", maxHeight: "none" },
  emptyState: { margin: 0, padding: "14px 12px" },
  actions: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
};
