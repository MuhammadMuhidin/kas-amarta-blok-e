"use client";

import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { shareMembersJpgReport } from "@/components/admin/exportMembersJpg";
import Toast from "@/components/Toast";
import { useState } from "react";

const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const normalize = (value) => String(value || "").trim();
const normalizeUpper = (value) => normalize(value).toUpperCase();

const overviewAdminCss = `
  .admin-wrapper .admin-status-meta-action-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .admin-wrapper .admin-insight-link {
    border: none;
    background: none;
    color: var(--admin-primary);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 0;
    white-space: nowrap;
  }

  .admin-wrapper .admin-insight-link:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .admin-wrapper .modal-overlay {
    animation: adminModalOverlayIn 0.18s ease-out;
  }

  .admin-wrapper .modal-box {
    animation: adminModalContentIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: center;
  }

  .admin-wrapper .detail-table {
    width: 100%;
    min-width: 0;
    margin: 10px auto 0;
    table-layout: auto;
  }

  .admin-wrapper .detail-table th,
  .admin-wrapper .detail-table td {
    white-space: nowrap;
  }

  @keyframes adminModalOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes adminModalContentIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .admin-wrapper .modal-overlay,
    .admin-wrapper .modal-box { animation: none; }
  }
`;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";
  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;
  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function sortMembers(items) {
  return [...items].sort((a, b) => normalize(a.house).localeCompare(normalize(b.house), "id-ID", { numeric: true }));
}

function isPaidDetailType(type) {
  return String(type || "").endsWith("-paid");
}

function Section({ title, children }) {
  return <section style={{ display: "grid", gap: 12 }}><h3 style={{ margin: 0 }}>{title}</h3>{children}</section>;
}

function QuickAction({ children, onClick }) {
  return <AdminActionButton onClick={onClick}>{children}</AdminActionButton>;
}

function AlertItem({ tone = "info", title, detail, action, onClick }) {
  const color = tone === "danger" ? "#dc2626" : tone === "warning" ? "#d97706" : "#2563eb";
  return (
    <div style={styles.alertItem}>
      <div>
        <div style={{ ...styles.alertTitle, color }}>{title}</div>
        <div style={styles.alertDetail}>{detail}</div>
      </div>
      {action && <AdminActionButton onClick={onClick}>{action}</AdminActionButton>}
    </div>
  );
}

function DetailMembersModal({ open, title, members, statusText, emptyText, shareLabel = "Share JPG", sharing = false, onShareJpg, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-section">{members.length} houses {statusText}.</div>
          </div>
          {onShareJpg && (
            <AdminActionButton loading={sharing} loadingText="Creating JPG..." disabled={members.length === 0} onClick={onShareJpg}>{shareLabel}</AdminActionButton>
          )}
        </div>

        <table className="detail-table">
          <thead>
            <tr>
              <th>No</th>
              <th>House</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr><td colSpan={3}>{emptyText}</td></tr>
            ) : members.map((person, index) => (
              <tr key={person.id || `${person.house}-${index}`}>
                <td>{index + 1}</td>
                <td>{person.house || "-"}</td>
                <td>{person.name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OverviewTab({
  personal,
  payments,
  trashRecords,
  cashflows,
  sortedDeposits,
  currentPeriod,
  appConfig,
  dailyBackup,
  monitoringIssueCount,
  getDepositStatus,
  onNavigate,
}) {
  const [sendingReport, setSendingReport] = useState(false);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [reportPreview, setReportPreview] = useState("");
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [unpaidDetail, setUnpaidDetail] = useState(null);
  const [showPaidTrashDetail, setShowPaidTrashDetail] = useState(false);
  const [exportingDetailJpg, setExportingDetailJpg] = useState("");
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  function showToast(type, message) {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((current) => (current.message === message ? { ...current, show: false } : current)), 2800);
  }

  async function openResidentReportConfirm() {
    if (loadingReportPreview || sendingReport) return;
    setLoadingReportPreview(true);
    try {
      const data = await sendJson("/api/waha/monthly-summary", "POST", { preview: true });
      setReportPreview(data.text || "");
      setShowReportConfirm(true);
    } catch (err) {
      showToast("error", err.message || "Failed to load report preview.");
    } finally {
      setLoadingReportPreview(false);
    }
  }

  async function sendResidentReport() {
    if (sendingReport) return;
    setSendingReport(true);
    try {
      await sendJson("/api/waha/monthly-summary", "POST", {});
      setShowReportConfirm(false);
      setReportPreview("");
      showToast("success", "Report successfully sent to the WhatsApp group.");
    } catch (err) {
      showToast("error", err.message || "Failed to send report to the group.");
    } finally {
      setSendingReport(false);
    }
  }

  function closeReportConfirm() {
    if (!sendingReport) setShowReportConfirm(false);
  }

  const activeMembers = personal.filter((person) => person.active === "Y");
  const activeCurrentMembers = activeMembers.filter((person) => !person.join_date || String(person.join_date).slice(0, 7) <= currentPeriod);
  const activeCurrentTrashMembers = activeCurrentMembers.filter((person) => normalizeUpper(person.trash) === "Y");
  const paymentById = new Map(payments.map((payment) => [normalize(payment.id), payment]));
  const paidCurrentKeys = new Set(payments.filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod).map((payment) => normalize(payment.person_house || payment.house || payment.person_id)));
  const paidCurrentCount = activeCurrentMembers.filter((person) => paidCurrentKeys.has(normalize(person.house))).length;
  const paidCurrentMembers = sortMembers(activeCurrentMembers.filter((person) => paidCurrentKeys.has(normalize(person.house))));
  const unpaidCurrentMembers = sortMembers(activeCurrentMembers.filter((person) => !paidCurrentKeys.has(normalize(person.house))));
  const unpaidCurrentCount = unpaidCurrentMembers.length;
  const trashPaidPersonIds = new Set(trashRecords.map((trash) => paymentById.get(normalize(trash.payment_id))).filter((payment) => payment && String(payment.date || "").slice(0, 7) === currentPeriod).map((payment) => normalize(payment.person_id)).filter(Boolean));
  const paidCurrentTrashMembers = sortMembers(activeCurrentTrashMembers.filter((person) => trashPaidPersonIds.has(normalize(person.id))));
  const paidCurrentTrashCount = paidCurrentTrashMembers.length;
  const unpaidCurrentTrashMembers = sortMembers(activeCurrentTrashMembers.filter((person) => !trashPaidPersonIds.has(normalize(person.id))));
  const unpaidCurrentTrashCount = unpaidCurrentTrashMembers.length;
  const currentMonthCashflows = cashflows.filter((item) => String(item.date || "").slice(0, 7) === currentPeriod);
  const currentIncome = currentMonthCashflows.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentExpense = currentMonthCashflows.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allIncome = cashflows.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allExpense = cashflows.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentBalance = allIncome - allExpense;
  const readyBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "pending");
  const waitingBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "waiting");
  const backupOk = Boolean(dailyBackup?.ok);
  const configOk = Boolean(appConfig);
  const recentCashflows = [...cashflows].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  const periodLabel = formatPeriod(currentPeriod);

  async function handleShareDetailJpg({ id, members, totalMembers, statusText, paymentLabel, amount, footerNote }) {
    if (exportingDetailJpg) return;
    setExportingDetailJpg(id);
    const isTrashPayment = paymentLabel === "Trash";
    const isPaidStatus = statusText === "Paid";

    try {
      const result = await shareMembersJpgReport({
        title: isTrashPayment ? "Trash Fee Payment" : "Cash Payment",
        period: currentPeriod,
        members,
        summaryItems: [
          ["Recorded", `${members.length}/${totalMembers} houses`, isPaidStatus ? "Fully paid" : "Unpaid"],
          ["Fee", money(amount), "per house"],
          ["Total", money(members.length * Number(amount || 0)), isPaidStatus ? "collected funds" : "uncollected funds"],
        ],
        badgeText: isPaidStatus ? "PAID" : "UNPAID",
        listTitle: "House List",
        noteText: isTrashPayment
          ? `The following houses have ${isPaidStatus ? "paid the trash fee" : "not paid the trash fee"}.`
          : `The following houses have ${isPaidStatus ? "paid cash dues" : "not paid cash dues"}.`,
        footerNote,
        fileName: `${paymentLabel.toLowerCase()}-${statusText.toLowerCase().replaceAll(" ", "-")}-${currentPeriod}.jpg`,
      });
      showToast("success", result === "shared" ? "JPG is ready to share." : "JPG downloaded successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to create JPG.");
    } finally {
      setExportingDetailJpg("");
    }
  }

  const alerts = [
    unpaidCurrentCount > 0 && { tone: "warning", title: `${unpaidCurrentCount} houses have not paid cash dues this month`, detail: `${periodLabel} still needs follow-up or checking.`, action: "Open Payment", tab: "payment" },
    unpaidCurrentTrashCount > 0 && { tone: "warning", title: `${unpaidCurrentTrashCount} houses have not paid trash fees this month`, detail: `${periodLabel} still needs follow-up or checking.`, action: "Open Payment", tab: "payment" },
    readyBookings.length > 0 && { tone: "info", title: `${readyBookings.length} bookings ready to pay`, detail: "There are booking payments ready to be paid.", action: "Open Booking", tab: "deposit" },
    monitoringIssueCount > 0 && { tone: "danger", title: `${monitoringIssueCount} monitoring issues`, detail: "There are data integrity or data quality items that need review.", action: "Open Monitoring", tab: "monitoring" },
    !backupOk && { tone: "danger", title: "Backup is not healthy yet", detail: "Daily backup status is not valid or has not been found.", action: "Open Monitoring", tab: "monitoring" },
  ].filter(Boolean);

  return (
    <>
      <style>{overviewAdminCss}</style>
      <Toast show={toast.show} type={toast.type} message={toast.message} />
      <div className="admin-card" style={{ display: "grid", gap: 22 }}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Overview</h2>
            <div style={styles.muted}>Operational summary for cash, payments, bookings, and system health.</div>
          </div>
          <div style={styles.periodBadge}>{periodLabel}</div>
        </div>

        <Section title="Quick Summary">
          <div className="admin-monitor-grid">
            <MonitoringCard label="Cash Balance" value={money(currentBalance)} meta={["Income minus expenses across all periods."]} error={currentBalance < 0} />
            <MonitoringCard label="This Month Income" value={money(currentIncome)} meta={[`Period ${periodLabel}`]} />
            <MonitoringCard label="This Month Expense" value={money(currentExpense)} meta={[`Period ${periodLabel}`]} />
            <MonitoringCard label="This Month Payment (Cash)" value={`${paidCurrentCount}/${activeCurrentMembers.length} houses`} meta={[`${unpaidCurrentCount} houses unpaid.`, `${paidCurrentCount} houses paid.`]} metaActions={[unpaidCurrentCount > 0 ? { label: "View details", onClick: () => setUnpaidDetail({ type: "kas-unpaid", title: "Unpaid Cash Details", members: unpaidCurrentMembers }) } : null, paidCurrentCount > 0 ? { label: "View details", onClick: () => setUnpaidDetail({ type: "kas-paid", title: "Paid Cash Details", members: paidCurrentMembers }) } : null]} error={unpaidCurrentCount > 0} />
            <MonitoringCard label="This Month Payment (Trash)" value={`${paidCurrentTrashCount}/${activeCurrentTrashMembers.length} houses`} meta={[`${unpaidCurrentTrashCount} houses unpaid.`, `${paidCurrentTrashCount} houses paid.`]} metaActions={[unpaidCurrentTrashCount > 0 ? { label: "View details", onClick: () => setUnpaidDetail({ type: "sampah-unpaid", title: "Unpaid Trash Details", members: unpaidCurrentTrashMembers }) } : null, { label: "View details", onClick: () => setShowPaidTrashDetail(true) }]} error={unpaidCurrentTrashCount > 0} />
            <MonitoringCard label="Ready Booking" value={`${readyBookings.length} houses`} meta={[`${waitingBookings.length} bookings waiting for the payment period.`]} error={readyBookings.length > 0} />
            <MonitoringCard label="Monitoring Issue" value={`${monitoringIssueCount} issue`} meta={[monitoringIssueCount ? "Need review" : "No issue detected"]} error={monitoringIssueCount > 0} />
          </div>
        </Section>

        <Section title="Resident Report">
          <div style={styles.reportCard}>
            <div>
              <div style={styles.reportTitle}>Send cash report to WhatsApp group</div>
              <div style={styles.reportDetail}>Review the message content before sending it to the resident group.</div>
            </div>
            <AdminActionButton onClick={openResidentReportConfirm} loading={loadingReportPreview} loadingText="Loading preview..." disabled={sendingReport}>Send Report to WhatsApp Group</AdminActionButton>
          </div>
        </Section>

        <Section title="Quick Actions">
          <div style={styles.quickActions}>
            <QuickAction onClick={() => onNavigate("payment")}>Record Payment</QuickAction>
            <QuickAction onClick={() => onNavigate("deposit")}>Booking Payment</QuickAction>
            <QuickAction onClick={() => onNavigate("cashflow")}>Record Cashflow</QuickAction>
            <QuickAction onClick={() => onNavigate("monitoring")}>Open Monitoring</QuickAction>
            <QuickAction onClick={() => onNavigate("summary")}>Backup Summary</QuickAction>
          </div>
        </Section>

        <Section title="Attention Needed">
          {alerts.length === 0 ? <div className="admin-empty-state">No special attention needed. The system looks stable.</div> : <div style={styles.alertList}>{alerts.map((alert) => <AlertItem key={alert.title} tone={alert.tone} title={alert.title} detail={alert.detail} action={alert.action} onClick={() => onNavigate(alert.tab)} />)}</div>}
        </Section>

        <Section title="Operational Snapshot">
          <div className="admin-monitor-grid">
            <MonitoringCard label="App Config" value={configOk ? "Ready" : "Not ready"} meta={configOk ? [`Cash: ${money(appConfig.monthly_fee)}`, `Trash: ${money(appConfig.trash_fee)}`] : ["Configuration is not available yet."]} error={!configOk} />
            <MonitoringCard label="Daily Backup" value={backupOk ? "Healthy" : "Need check"} meta={backupOk ? [`File: ${dailyBackup.name}`, `Retention: ${dailyBackup.count} backup files`] : ["Daily backup is not valid yet."]} error={!backupOk} />
            <MonitoringCard label="Active Members" value={`${activeMembers.length} houses`} meta={[`${activeCurrentMembers.length} houses active in this period.`]} />
          </div>
        </Section>

        <Section title="Recent Cashflow">
          {recentCashflows.length === 0 ? <div className="admin-empty-state">No cashflow transactions yet.</div> : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th className="admin-th">Date</th><th className="admin-th">Type</th><th className="admin-th">Amount</th><th className="admin-th">Note</th></tr></thead>
                <tbody>{recentCashflows.map((item, index) => <tr key={item.id || index} className={index % 2 ? "admin-row-alt" : ""}><td className="admin-td">{formatDate(item.date)}</td><td className="admin-td">{item.type}</td><td className="admin-td">{money(item.amount)}</td><td className="admin-td">{item.note || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <DetailMembersModal
        open={Boolean(unpaidDetail)}
        title={unpaidDetail?.title || "Payment Details"}
        members={unpaidDetail?.members || []}
        statusText={isPaidDetailType(unpaidDetail?.type) ? "paid" : "unpaid"}
        emptyText="No house data."
        sharing={exportingDetailJpg === unpaidDetail?.type}
        onShareJpg={unpaidDetail ? () => handleShareDetailJpg({
          id: unpaidDetail.type,
          members: unpaidDetail.members,
          totalMembers: unpaidDetail.type?.startsWith("sampah") ? activeCurrentTrashMembers.length : activeCurrentMembers.length,
          statusText: isPaidDetailType(unpaidDetail.type) ? "Paid" : "Unpaid",
          paymentLabel: unpaidDetail.type?.startsWith("sampah") ? "Trash" : "Cash",
          amount: unpaidDetail.type?.startsWith("sampah") ? appConfig?.trash_fee : appConfig?.monthly_fee,
          footerNote: "If any data is inaccurate, please confirm with the cash admin.",
        }) : undefined}
        onClose={() => setUnpaidDetail(null)}
      />
      <DetailMembersModal
        open={showPaidTrashDetail}
        title="Paid Trash Details"
        members={paidCurrentTrashMembers}
        statusText="paid"
        emptyText="No houses have paid the trash fee this month yet."
        sharing={exportingDetailJpg === "sampah-paid"}
        onShareJpg={() => handleShareDetailJpg({
          id: "sampah-paid",
          members: paidCurrentTrashMembers,
          totalMembers: activeCurrentTrashMembers.length,
          statusText: "Paid",
          paymentLabel: "Trash",
          amount: appConfig?.trash_fee,
          footerNote: "If any data is inaccurate, please confirm with the cash admin.",
        })}
        onClose={() => setShowPaidTrashDetail(false)}
      />

      <AdminConfirmModal open={showReportConfirm} title="Confirm resident report delivery" description="Make sure the message content is correct before sending it to the WhatsApp group." confirmText="Send to Group" cancelText="Check Again" loading={sendingReport} onCancel={closeReportConfirm} onConfirm={sendResidentReport}>
        <pre style={styles.previewBox}>{reportPreview}</pre>
      </AdminConfirmModal>
    </>
  );
}

const styles = {
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  muted: { color: "var(--admin-muted)", fontSize: 13, fontWeight: 600, lineHeight: 1.6 },
  periodBadge: { padding: "8px 12px", borderRadius: 999, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-muted)", fontSize: 12, fontWeight: 800 },
  quickActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  reportCard: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 16, borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)", flexWrap: "wrap" },
  reportTitle: { fontSize: 15, fontWeight: 900, marginBottom: 4 },
  reportDetail: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  previewBox: { margin: 0, padding: 14, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  alertList: { display: "grid", gap: 10 },
  alertItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)" },
  alertTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  alertDetail: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
};