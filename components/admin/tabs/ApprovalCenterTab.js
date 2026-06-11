"use client";

import Toast from "@/components/Toast";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import { useEffect, useState } from "react";

const APPROVAL_REQUESTS_API = "/api/admin/approval-requests";

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

export default function ApprovalCenterTab() {
  const [data, setData] = useState({ summary: {}, inbox: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState("");
  const [toast, setToast] = useState(null);

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

  if (loading) return <div className="admin-card">Loading Approval Center...</div>;

  return (
    <>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <div className="admin-card">
        <div className="activity-header">
          <div>
            <div className="activity-kicker">Approval Workflow</div>
            <h3 className="activity-title">Approval Center</h3>
            <p className="activity-subtitle">Inbox pengurus untuk validasi pembayaran, approve, reject, dan monitoring pengajuan warga.</p>
          </div>
          <button type="button" className="admin-small-btn admin-refresh-btn" onClick={loadData}>Refresh</button>
        </div>

        <div className="admin-summary-cards" style={styles.summaryCards}>
          <SummaryCard label="Inbox Saya" value={data.summary?.inbox || 0} />
          <SummaryCard label="Sedang Proses" value={data.summary?.processing || 0} />
          <SummaryCard label="Selesai" value={data.summary?.completed || 0} />
          <SummaryCard label="Ditolak" value={data.summary?.rejected || 0} />
        </div>

        <Section title="Inbox Saya" description="Hanya pengajuan yang sedang menunggu role kamu.">
          <RequestTable rows={data.inbox || []} runningId={runningId} onAction={runAction} showActions />
        </Section>

        <Section title="Semua Pengajuan Terbaru" description="Daftar pengajuan terbaru untuk monitoring.">
          <RequestTable rows={data.requests || []} runningId={runningId} onAction={runAction} />
        </Section>
      </div>
    </>
  );
}

function SummaryCard({ label, value }) {
  return <div className="admin-summary-card"><div className="admin-status-label">{label}</div><div className="admin-status-value" style={{ marginBottom: 0 }}>{value}</div></div>;
}

function Section({ title, description, children }) {
  return <section className="admin-status-card" style={styles.section}><div className="admin-status-label">{title}</div>{description && <div className="admin-status-meta" style={{ marginBottom: 12 }}>{description}</div>}{children}</section>;
}

function RequestTable({ rows, runningId, onAction, showActions = false }) {
  if (!rows.length) return <div className="admin-empty-state">Tidak ada pengajuan.</div>;

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
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
              <td className="admin-td">{row.request_no}</td>
              <td className="admin-td">{row.master_name}</td>
              <td className="admin-td">{row.requester_name || "-"}<div className="activity-muted">{row.requester_house || "-"}</div></td>
              <td className="admin-td"><StatusBadge status={row.status} /></td>
              <td className="admin-td">{row.current_approver_role || "-"}</td>
              <td className="admin-td">{row.amount ? money(row.amount) : "-"}</td>
              <td className="admin-td">{formatTime(row.created_at)}</td>
              {showActions && <td className="admin-td"><div style={styles.actions}><button type="button" className="admin-small-btn" disabled={!!runningId} onClick={() => onAction(row, row.status === "waiting_payment_validation" ? "validate_payment" : "approve")}>{runningId === `${row.id}-approve` ? "Processing..." : row.status === "waiting_payment_validation" ? "Validasi" : "Approve"}</button><button type="button" className="admin-small-btn" disabled={!!runningId} onClick={() => onAction(row, "reject")}>Reject</button></div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  summaryCards: { marginBottom: 16 },
  section: { marginTop: 14, marginBottom: 0 },
  actions: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
};
