"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { shareMembersJpgReport, shareMembersJpgReportMinimalist } from "@/components/admin/exportMembersJpg";
import Toast from "@/components/Toast";
import useInfiniteRows from "@/components/admin/useInfiniteRows";
import { useEffect, useMemo, useState } from "react";

const DETAIL_PAGE_SIZE = 13;
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const normalize = (value) => String(value || "").trim();
const normalizeUpper = (value) => normalize(value).toUpperCase();

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";
  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;
  return new Date(`${normalized}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function sortMembers(items) {
  return [...items].sort((a, b) => normalize(a.house).localeCompare(
    normalize(b.house),
    "id-ID",
    { numeric: true },
  ));
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(value || 0) / Number(total)) * 100)));
}

function getTrashAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function useModalScrollLock(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function CashBalanceHero({ value }) {
  const negative = Number(value || 0) < 0;
  return (
    <section
      className={negative
        ? "overview-hero-card overview-hero-card-danger"
        : "overview-hero-card overview-hero-card-healthy"}
      style={{ ...styles.heroCard, borderColor: negative ? "#dc2626" : "var(--admin-border)" }}
    >
      <div>
        <div style={styles.heroLabel}>Cash Balance</div>
        <div style={{ ...styles.heroValue, color: negative ? "#dc2626" : "var(--admin-text)" }}>
          {money(value)}
        </div>
        <div style={styles.muted}>Income minus expenses across all periods.</div>
      </div>
      <div style={{ ...styles.heroBadge, color: negative ? "#dc2626" : "#16a34a" }}>
        {negative ? "Need Review" : "Healthy"}
      </div>
    </section>
  );
}

function ProgressCard({ label, paid, total, unpaid, actions = [], error = false }) {
  const percent = getPercent(paid, total);
  return (
    <div style={{ ...styles.progressCard, borderColor: error ? "#d97706" : "var(--admin-border)" }}>
      <div style={styles.progressHeader}>
        <div>
          <div style={styles.heroLabel}>{label}</div>
          <div style={styles.progressValue}>{paid}/{total} houses</div>
        </div>
        <strong style={{ color: error ? "#d97706" : "#16a34a" }}>{percent}%</strong>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${percent}%` }} />
      </div>
      <div style={styles.progressMeta}>
        <span>{unpaid} unpaid</span>
        <span>{paid} paid</span>
      </div>
      {actions.filter(Boolean).length > 0 && (
        <div style={styles.rowActions}>
          {actions.filter(Boolean).map((action) => (
            <button
              key={action.label}
              type="button"
              className="admin-small-btn"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CashDetailModal({ open, status, periodLabel, paidCount, unpaidCount, totalPaidAmount, totalDueAmount, sharing, onShareFull, onShareMinimalist, onClose }) {
  useModalScrollLock(open);
  const [showFormatChoice, setShowFormatChoice] = useState(false);
  useEffect(() => setShowFormatChoice(false), [open, sharing]);
  if (!open) return null;

  const {
    items: members,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
  } = useInfiniteRows({
    pageSize: 15,
    buildUrl: ({ page, limit }) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
      });
      return `/api/sheets/payment/view?${params.toString()}`;
    },
    deps: [status],
    getItems: (data) => data.members || [],
    getPagination: (data) => data.pagination || {},
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxHeight: "calc(100dvh - 64px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div style={styles.modalHeader}>
            <div>
              <div className="modal-title">Cash Payment Details</div>
              <div className="modal-section">
                {total} members · {periodLabel} · {status === "paid" ? "Paid" : status === "unpaid" ? "Unpaid" : "All"}
              </div>
            </div>
            <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          </div>
          <div style={styles.rowActions}>
            <div style={{ position: "relative" }}>
              <AdminActionButton
                loading={sharing}
                disabled={!members.length || sharing}
                onClick={() => setShowFormatChoice((v) => !v)}
              >
                Share JPG
              </AdminActionButton>
              {showFormatChoice && !sharing && (
                <div style={styles.formatChoiceDropdown}>
                  <button
                    type="button"
                    style={styles.formatChoiceOption}
                    onClick={() => { setShowFormatChoice(false); onShareFull(); }}
                  >
                    <span style={styles.formatChoiceIcon}>🖼️</span>
                    <div>
                      <strong>Full (Existing)</strong>
                      <div style={styles.muted}>Current full-color format</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    style={styles.formatChoiceOption}
                    onClick={() => { setShowFormatChoice(false); onShareMinimalist(); }}
                  >
                    <span style={styles.formatChoiceIcon}>🧾</span>
                    <div>
                      <strong>Minimalist (Receipt)</strong>
                      <div style={styles.muted}>Black & white receipt style</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="admin-small-btn"
              disabled={loading || loadingMore}
              onClick={refresh}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="admin-monitor-grid" style={{ marginBottom: 12 }}>
          <MonitoringCard label="Paid" value={money(paidCount)} meta={[]} />
          <MonitoringCard label="Unpaid" value={money(unpaidCount)} meta={[]} />
          <MonitoringCard label="Total Paid" value={money(totalPaidAmount)} meta={[]} />
          <MonitoringCard label="Total Due" value={money(totalDueAmount)} meta={[]} />
        </div>
        {error && <div className="admin-error-box">{error}</div>}
        <div style={styles.memberList}>
          {members.map((person) => (
            <div key={person.id} style={styles.memberItem}>
              <div>
                <strong>{person.house}</strong>
                <div style={styles.muted}>{person.name}</div>
              </div>
              <span>{person.paymentStatus}</span>
            </div>
          ))}
          {loading && <div className="admin-empty-state">Loading...</div>}
          {!loading && !loadingMore && members.length === 0 && (
            <div className="admin-empty-state">No members found.</div>
          )}
          {hasMore && <div ref={loaderRef} style={{ height: 1 }} />}
          {loadingMore && <div className="admin-empty-state">Loading more...</div>}
        </div>
      </div>
    </div>
  );
}

function MemberDetailModal({ detail, onClose, onShareFull, onShareMinimalist, sharing }) {
  const [page, setPage] = useState(0);
  const [showFormatChoice, setShowFormatChoice] = useState(false);
  useModalScrollLock(Boolean(detail));

  useEffect(() => setPage(0), [detail]);
  useEffect(() => setShowFormatChoice(false), [detail, sharing]);
  if (!detail) return null;

  const members = detail.members || [];
  const totalPages = Math.max(1, Math.ceil(members.length / DETAIL_PAGE_SIZE));
  const visible = members.slice(page * DETAIL_PAGE_SIZE, (page + 1) * DETAIL_PAGE_SIZE);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxHeight: "calc(100dvh - 64px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div style={styles.modalHeader}>
            <div>
              <div className="modal-title">{detail.title}</div>
              <div className="modal-section">{members.length} houses.</div>
            </div>
            <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          </div>
          <div style={{ position: "relative" }}>
            <AdminActionButton
              loading={sharing}
              loadingText="Creating JPG..."
              disabled={!members.length || sharing}
              onClick={() => setShowFormatChoice((v) => !v)}
            >
              Share JPG
            </AdminActionButton>
            {showFormatChoice && !sharing && (
              <div style={styles.formatChoiceDropdown}>
                <button
                  type="button"
                  style={styles.formatChoiceOption}
                  onClick={() => { setShowFormatChoice(false); onShareFull(); }}
                >
                  <span style={styles.formatChoiceIcon}>🖼️</span>
                  <div>
                    <strong>Full (Existing)</strong>
                    <div style={styles.muted}>Current full-color format</div>
                  </div>
                </button>
                <button
                  type="button"
                  style={styles.formatChoiceOption}
                  onClick={() => { setShowFormatChoice(false); onShareMinimalist(); }}
                >
                  <span style={styles.formatChoiceIcon}>🧾</span>
                  <div>
                    <strong>Minimalist (Receipt)</strong>
                    <div style={styles.muted}>Black &amp; white receipt style</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-th">No</th>
                <th className="admin-th">House</th>
                <th className="admin-th">Name</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((person, index) => (
                <tr key={person.id || `${person.house}-${index}`}>
                  <td className="admin-td">{page * DETAIL_PAGE_SIZE + index + 1}</td>
                  <td className="admin-td">{person.house || "-"}</td>
                  <td className="admin-td">{person.name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              type="button"
              className="admin-small-btn"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </button>
            <span>{page + 1}/{totalPages}</span>
            <button
              type="button"
              className="admin-small-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrashDetailModal({
  open,
  members,
  periodLabel,
  currentBalance,
  totalNeedAdvance,
  totalAdvanced,
  totalReimbursed,
  advancing,
  sharing,
  onAdvance,
  onShareFull,
  onShareMinimalist,
  onClose,
}) {
  useModalScrollLock(open);
  const [showFormatChoice, setShowFormatChoice] = useState(false);
  useEffect(() => setShowFormatChoice(false), [open, sharing]);
  if (!open) return null;
  const projected = Number(currentBalance || 0) - Number(totalNeedAdvance || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxHeight: "calc(100dvh - 64px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div style={styles.modalHeader}>
            <div>
              <div className="modal-title">Trash Payment Details</div>
              <div className="modal-section">{members.length} members · {periodLabel}</div>
            </div>
            <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          </div>
          <div style={styles.rowActions}>
            <div style={{ position: "relative" }}>
              <AdminActionButton loading={sharing} disabled={advancing || sharing} onClick={() => setShowFormatChoice((v) => !v)}>
                Share JPG
              </AdminActionButton>
              {showFormatChoice && !sharing && (
                <div style={styles.formatChoiceDropdown}>
                  <button
                    type="button"
                    style={styles.formatChoiceOption}
                    onClick={() => { setShowFormatChoice(false); onShareFull(); }}
                  >
                    <span style={styles.formatChoiceIcon}>🖼️</span>
                    <div>
                      <strong>Full (Existing)</strong>
                      <div style={styles.muted}>Current full-color format</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    style={styles.formatChoiceOption}
                    onClick={() => { setShowFormatChoice(false); onShareMinimalist(); }}
                  >
                    <span style={styles.formatChoiceIcon}>🧾</span>
                    <div>
                      <strong>Minimalist (Receipt)</strong>
                      <div style={styles.muted}>Black &amp; white receipt style</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            <AdminActionButton
              loading={advancing}
              disabled={sharing || totalNeedAdvance <= 0}
              onClick={onAdvance}
            >
              Advance Unpaid Trash
            </AdminActionButton>
          </div>
        </div>
        <div className="admin-monitor-grid" style={{ marginBottom: 12 }}>
          <MonitoringCard label="Need Advance" value={money(totalNeedAdvance)} meta={[]} error={totalNeedAdvance > 0} />
          <MonitoringCard label="Outstanding" value={money(totalAdvanced)} meta={[]} error={totalAdvanced > 0} />
          <MonitoringCard label="Reimbursed" value={money(totalReimbursed)} meta={[]} />
          <MonitoringCard
            label="Projected Balance"
            value={money(projected)}
            meta={[]}
            error={projected < 0}
          />
        </div>
        <div style={styles.memberList}>
          {members.map((person) => (
            <div key={person.id} style={styles.memberItem}>
              <div>
                <strong>{person.house}</strong>
                <div style={styles.muted}>{person.name}</div>
              </div>
              <span>{person.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, subtitle, onClick }) {
  return (
    <button type="button" style={styles.quickAction} onClick={onClick}>
      <strong>{title}</strong>
      <span style={styles.muted}>{subtitle}</span>
    </button>
  );
}

function AlertItem({ alert, onNavigate }) {
  const color = alert.tone === "danger" ? "#dc2626" : alert.tone === "warning" ? "#d97706" : "#2563eb";
  return (
    <div style={styles.alertItem}>
      <div>
        <strong style={{ color }}>{alert.title}</strong>
        <div style={styles.muted}>{alert.detail}</div>
      </div>
      <button type="button" className="admin-small-btn" onClick={() => onNavigate(alert.tab)}>
        {alert.action}
      </button>
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
  onTrashAdvanceComplete,
}) {
  const [activePanel, setActivePanel] = useState("summary");
  const [sendingReport, setSendingReport] = useState(false);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [reportPreview, setReportPreview] = useState("");
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [memberDetail, setMemberDetail] = useState(null);
  const [showTrashDetail, setShowTrashDetail] = useState(false);
  const [showTrashAdvanceConfirm, setShowTrashAdvanceConfirm] = useState(false);
  const [advancingTrash, setAdvancingTrash] = useState(false);
  const [exportingDetailJpg, setExportingDetailJpg] = useState("");
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });
  const [showCashDetail, setShowCashDetail] = useState(false);
  const [cashDetailStatus, setCashDetailStatus] = useState("all");

  useModalScrollLock(showReportConfirm || showTrashAdvanceConfirm || showCashDetail);

  const derived = useMemo(() => {
    const activeMembers = personal.filter((person) => person.active === "Y");
    const activeCurrentMembers = activeMembers.filter(
      (person) => !person.join_date || String(person.join_date).slice(0, 7) <= currentPeriod,
    );
    const activeTrashMembers = activeCurrentMembers.filter(
      (person) => normalizeUpper(person.trash) === "Y",
    );
    const paymentById = new Map(payments.map((payment) => [normalize(payment.id), payment]));
    const paidCurrentKeys = new Set(
      payments
        .filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod)
        .map((payment) => normalize(payment.person_house || payment.house || payment.person_id)),
    );
    const paidMembers = sortMembers(activeCurrentMembers.filter(
      (person) => paidCurrentKeys.has(normalize(person.house)),
    ));
    const unpaidMembers = sortMembers(activeCurrentMembers.filter(
      (person) => !paidCurrentKeys.has(normalize(person.house)),
    ));
    const trashPaidPersonIds = new Set(
      trashRecords
        .map((trash) => paymentById.get(normalize(trash.payment_id)))
        .filter((payment) => payment && String(payment.date || "").slice(0, 7) === currentPeriod)
        .map((payment) => normalize(payment.person_id))
        .filter(Boolean),
    );
    const trashAdvanceRefIds = new Set(
      cashflows
        .map((item) => normalize(item.ref_id))
        .filter((refId) => refId.startsWith("TRASHADV-") && refId.endsWith(`-${currentPeriod}`)),
    );
    const paidTrashMembers = sortMembers(activeTrashMembers.filter(
      (person) => trashPaidPersonIds.has(normalize(person.id)),
    ));
    const unpaidTrashMembers = sortMembers(activeTrashMembers.filter(
      (person) => !trashPaidPersonIds.has(normalize(person.id)),
    ));
    const allTrashMembers = sortMembers(activeTrashMembers).map((person) => {
      const personId = normalize(person.id);
      const trashPaid = trashPaidPersonIds.has(personId);
      const hasTrashAdvance = trashAdvanceRefIds.has(getTrashAdvanceRefId(personId, currentPeriod));
      const trashReimbursed = trashPaid && hasTrashAdvance;
      const trashAdvanced = !trashPaid && hasTrashAdvance;
      return {
        ...person,
        trashPaid,
        trashAdvanced,
        trashReimbursed,
        status: trashReimbursed
          ? "Reimbursed"
          : trashPaid
            ? "Paid"
            : trashAdvanced
              ? "Advanced"
              : "Need Advance",
      };
    });
    const needAdvanceCount = allTrashMembers.filter(
      (person) => !person.trashPaid && !person.trashAdvanced,
    ).length;
    const advancedCount = allTrashMembers.filter((person) => person.trashAdvanced).length;
    const reimbursedCount = allTrashMembers.filter((person) => person.trashReimbursed).length;
    const allIncome = cashflows
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allExpense = cashflows
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      activeCurrentMembers,
      activeTrashMembers,
      paidMembers,
      unpaidMembers,
      paidTrashMembers,
      unpaidTrashMembers,
      allTrashMembers,
      needAdvanceCount,
      advancedCount,
      reimbursedCount,
      totalNeedAdvance: needAdvanceCount * Number(appConfig?.trash_fee || 0),
      totalAdvanced: advancedCount * Number(appConfig?.trash_fee || 0),
      totalReimbursed: reimbursedCount * Number(appConfig?.trash_fee || 0),
      currentBalance: allIncome - allExpense,
      readyBookings: sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "pending"),
      waitingBookings: sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "waiting"),
      recentCashflows: [...cashflows]
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .slice(0, 8),
      paidCount: paidMembers.length,
      unpaidCount: unpaidMembers.length,
      totalPaidAmount: paidMembers.length * Number(appConfig?.monthly_fee || 0),
      totalDueAmount: activeCurrentMembers.length * Number(appConfig?.monthly_fee || 0),
    };
  }, [personal, payments, trashRecords, cashflows, sortedDeposits, currentPeriod, appConfig, getDepositStatus]);

  function showToast(type, message) {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((current) => (
      current.message === message ? { ...current, show: false } : current
    )), 2800);
  }

  async function openResidentReportConfirm() {
    if (loadingReportPreview || sendingReport) return;
    setLoadingReportPreview(true);
    try {
      const data = await sendJson("/api/waha/monthly-summary", "POST", { preview: true });
      setReportPreview(data.text || "");
      setShowReportConfirm(true);
    } catch (error) {
      showToast("error", error.message || "Failed to load report preview.");
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
    } catch (error) {
      showToast("error", error.message || "Failed to send report to the group.");
    } finally {
      setSendingReport(false);
    }
  }

  async function shareDetail(detail, format = "full") {
    if (!detail || exportingDetailJpg) return;
    setExportingDetailJpg(detail.id);
    try {
      const exportFn = format === "minimalist" ? shareMembersJpgReportMinimalist : shareMembersJpgReport;
      const fileNameBase = `${detail.paymentLabel.toLowerCase()}-${detail.statusText.toLowerCase()}-${currentPeriod}`;
      const fileName = format === "minimalist" ? `${fileNameBase}-receipt.jpg` : `${fileNameBase}.jpg`;
      const result = await exportFn({
        title: detail.paymentLabel === "Trash" ? "Trash Fee Payment" : "Cash Payment",
        period: currentPeriod,
        members: detail.members,
        summaryItems: [
          ["Recorded", `${detail.members.length}/${detail.totalMembers} houses`, detail.statusText],
          ["Fee", money(detail.amount), "per house"],
          ["Total", money(detail.members.length * Number(detail.amount || 0)), "amount"],
        ],
        badgeText: detail.statusText.toUpperCase(),
        listTitle: "House List",
        noteText: detail.note,
        footerNote: "If any data is inaccurate, please confirm with the cash admin.",
        fileName,
      });
      showToast("success", result === "shared" ? "JPG is ready to share." : "JPG downloaded successfully.");
    } catch (error) {
      showToast("error", error.message || "Failed to create JPG.");
    } finally {
      setExportingDetailJpg("");
    }
  }

  async function shareAllTrash(format = "full") {
    const detail = {
      id: "trash-all",
      paymentLabel: "Trash",
      statusText: "Report",
      members: derived.allTrashMembers,
      totalMembers: derived.allTrashMembers.length,
      amount: appConfig?.trash_fee,
      note: "Paid, reimbursed, advanced, and unpaid trash member status.",
    };
    await shareDetail(detail, format);
  }

  async function advanceTrash() {
    if (advancingTrash || derived.needAdvanceCount === 0) return;
    setAdvancingTrash(true);
    try {
      const data = await sendJson("/api/sheets/trash/advance-bulk", "POST", {
        period: currentPeriod,
      });
      await onTrashAdvanceComplete?.();
      setShowTrashAdvanceConfirm(false);
      setShowTrashDetail(false);
      showToast("success", `Advanced ${data.advanced || 0} trash expenses. Total ${money(data.total || 0)}.`);
    } catch (error) {
      showToast("error", error.message || "Failed to advance unpaid trash.");
    } finally {
      setAdvancingTrash(false);
    }
  }

  const periodLabel = formatPeriod(currentPeriod);
  const alerts = [
    derived.unpaidMembers.length > 0 && {
      tone: "warning",
      title: `${derived.unpaidMembers.length} houses have not paid cash dues`,
      detail: `${periodLabel} still needs follow-up.`,
      action: "Open Payment",
      tab: "payment",
    },
    derived.unpaidTrashMembers.length > 0 && {
      tone: "warning",
      title: `${derived.unpaidTrashMembers.length} houses have not paid trash fees`,
      detail: `${periodLabel} still needs follow-up.`,
      action: "Open Payment",
      tab: "payment",
    },
    derived.readyBookings.length > 0 && {
      tone: "info",
      title: `${derived.readyBookings.length} bookings ready to pay`,
      detail: "Booking payments are ready for processing.",
      action: "Open Booking",
      tab: "deposit",
    },
    monitoringIssueCount > 0 && {
      tone: "danger",
      title: `${monitoringIssueCount} monitoring issues`,
      detail: "Data integrity items need review.",
      action: "Open Monitoring",
      tab: "monitoring",
    },
    !dailyBackup?.ok && {
      tone: "danger",
      title: "Backup is not healthy",
      detail: "Daily backup status is not valid.",
      action: "Open Backup",
      tab: "summary",
    },
  ].filter(Boolean);

  return (
    <>
      <Toast show={toast.show} type={toast.type} message={toast.message} />
      <div className="admin-card" style={{ display: "grid", gap: 18 }}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Overview</h2>
            <div style={styles.muted}>Operational summary for the current period.</div>
          </div>
          <div style={styles.periodBadge}>{periodLabel}</div>
        </div>

        <AdminSubtabs
          value={activePanel}
          onChange={setActivePanel}
          ariaLabel="Overview navigation"
          items={[
            { value: "summary", label: "Summary", panelId: "overview-summary-panel" },
            {
              value: "actions",
              label: "Actions & Alerts",
              badge: alerts.length,
              panelId: "overview-actions-panel",
            },
            { value: "cashflow", label: "Recent Cashflow", panelId: "overview-cashflow-panel" },
          ]}
        />

        {activePanel === "summary" && (
          <div id="overview-summary-panel" role="tabpanel" style={styles.panel}>
            <CashBalanceHero value={derived.currentBalance} />
            <Section title="Payment Progress">
              <div style={styles.twoColumnGrid}>
                <ProgressCard
                  label="Cash Payment"
                  paid={derived.paidMembers.length}
                  total={derived.activeCurrentMembers.length}
                  unpaid={derived.unpaidMembers.length}
                  error={derived.unpaidMembers.length > 0}
                  actions={[
                    derived.unpaidMembers.length > 0 && {
                      label: "View Unpaid",
                      onClick: () => {
                        setCashDetailStatus("unpaid");
                        setShowCashDetail(true);
                      },
                    },
                    derived.paidMembers.length > 0 && {
                      label: "View Paid",
                      onClick: () => {
                        setCashDetailStatus("paid");
                        setShowCashDetail(true);
                      },
                    },
                    {
                      label: "View All",
                      onClick: () => {
                        setCashDetailStatus("all");
                        setShowCashDetail(true);
                      },
                    },
                  ]}
                />
                <ProgressCard
                  label="Trash Payment"
                  paid={derived.paidTrashMembers.length}
                  total={derived.activeTrashMembers.length}
                  unpaid={derived.unpaidTrashMembers.length}
                  error={derived.unpaidTrashMembers.length > 0}
                  actions={[
                    derived.unpaidTrashMembers.length > 0 && {
                      label: "View Unpaid",
                      onClick: () => setMemberDetail({
                        id: "trash-unpaid",
                        title: "Unpaid Trash Details",
                        members: derived.unpaidTrashMembers,
                        totalMembers: derived.activeTrashMembers.length,
                        statusText: "Unpaid",
                        paymentLabel: "Trash",
                        amount: appConfig?.trash_fee,
                        note: "Houses that have not paid trash fees.",
                      }),
                    },
                    { label: "View All", onClick: () => setShowTrashDetail(true) },
                  ]}
                />
              </div>
            </Section>
            <Section title="Action Status">
              <div className="admin-monitor-grid">
                <MonitoringCard
                  label="Ready Booking"
                  value={`${derived.readyBookings.length} houses`}
                  meta={[`${derived.waitingBookings.length} bookings are waiting.`]}
                  error={derived.readyBookings.length > 0}
                />
                <MonitoringCard
                  label="Monitoring Issue"
                  value={`${monitoringIssueCount} issue`}
                  meta={[monitoringIssueCount ? "Need review" : "No issue detected"]}
                  error={monitoringIssueCount > 0}
                />
              </div>
            </Section>
          </div>
        )}

        {activePanel === "actions" && (
          <div id="overview-actions-panel" role="tabpanel" style={styles.panel}>
            <Section title="Resident Report">
              <div style={styles.reportCard}>
                <div>
                  <strong>WhatsApp Cash Report</strong>
                  <div style={styles.muted}>Preview before sending to the resident group.</div>
                </div>
                <AdminActionButton
                  onClick={openResidentReportConfirm}
                  loading={loadingReportPreview}
                  loadingText="Loading preview..."
                  disabled={sendingReport}
                >
                  Preview & Send
                </AdminActionButton>
              </div>
            </Section>
            <Section title="Quick Actions">
              <div style={styles.quickActions}>
                <QuickAction title="Payment" subtitle="Record dues" onClick={() => onNavigate("payment")} />
                <QuickAction title="Booking" subtitle="Process booking" onClick={() => onNavigate("deposit")} />
                <QuickAction title="Cashflow" subtitle="Add transaction" onClick={() => onNavigate("cashflow")} />
                <QuickAction title="Monitoring" subtitle="Review issues" onClick={() => onNavigate("monitoring")} />
                <QuickAction title="Backup" subtitle="Open summary" onClick={() => onNavigate("summary")} />
              </div>
            </Section>
            <Section title="Attention Needed">
              {alerts.length === 0 ? (
                <div className="admin-empty-state">No special attention is needed.</div>
              ) : (
                <div style={styles.alertList}>
                  {alerts.map((alert) => (
                    <AlertItem key={alert.title} alert={alert} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {activePanel === "cashflow" && (
          <div id="overview-cashflow-panel" role="tabpanel" style={styles.panel}>
            <Section title="Recent Cashflow">
              {derived.recentCashflows.length === 0 ? (
                <div className="admin-empty-state">No cashflow transactions yet.</div>
              ) : (
                <div style={styles.cashflowList}>
                  {derived.recentCashflows.map((item) => (
                    <div key={item.id || `${item.date}-${item.note}`} style={styles.cashflowItem}>
                      <span style={{ color: item.type === "income" ? "#16a34a" : "#dc2626", fontWeight: 900 }}>
                        {item.type === "income" ? "Income" : "Expense"}
                      </span>
                      <span>{item.note || "-"}</span>
                      <strong>{money(item.amount)}</strong>
                      <span style={styles.muted}>{formatDate(item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      <MemberDetailModal
        detail={memberDetail}
        sharing={exportingDetailJpg === memberDetail?.id}
        onShareFull={() => shareDetail(memberDetail, "full")}
        onShareMinimalist={() => shareDetail(memberDetail, "minimalist")}
        onClose={() => setMemberDetail(null)}
      />
      <TrashDetailModal
        open={showTrashDetail}
        members={derived.allTrashMembers}
        periodLabel={periodLabel}
        currentBalance={derived.currentBalance}
        totalNeedAdvance={derived.totalNeedAdvance}
        totalAdvanced={derived.totalAdvanced}
        totalReimbursed={derived.totalReimbursed}
        advancing={advancingTrash}
        sharing={exportingDetailJpg === "trash-all"}
        onShareFull={() => shareAllTrash("full")}
        onShareMinimalist={() => shareAllTrash("minimalist")}
        onAdvance={() => setShowTrashAdvanceConfirm(true)}
        onClose={() => setShowTrashDetail(false)}
      />
      <CashDetailModal
        open={showCashDetail}
        status={cashDetailStatus}
        periodLabel={periodLabel}
        paidCount={derived.paidCount}
        unpaidCount={derived.unpaidCount}
        totalPaidAmount={derived.totalPaidAmount}
        totalDueAmount={derived.totalDueAmount}
        sharing={exportingDetailJpg === "cash-detail"}
        onShareFull={() => {
          setExportingDetailJpg("cash-detail");
          const detail = {
            id: "cash-detail",
            paymentLabel: "Cash",
            statusText: cashDetailStatus === "paid" ? "Paid" : cashDetailStatus === "unpaid" ? "Unpaid" : "All",
            members: [],
            totalMembers: derived.activeCurrentMembers.length,
            amount: appConfig?.monthly_fee,
            note: `Cash payment ${cashDetailStatus} member status.`,
          };
          shareDetail(detail, "full").finally(() => setExportingDetailJpg(""));
        }}
        onShareMinimalist={() => {
          setExportingDetailJpg("cash-detail");
          const detail = {
            id: "cash-detail",
            paymentLabel: "Cash",
            statusText: cashDetailStatus === "paid" ? "Paid" : cashDetailStatus === "unpaid" ? "Unpaid" : "All",
            members: [],
            totalMembers: derived.activeCurrentMembers.length,
            amount: appConfig?.monthly_fee,
            note: `Cash payment ${cashDetailStatus} member status.`,
          };
          shareDetail(detail, "minimalist").finally(() => setExportingDetailJpg(""));
        }}
        onClose={() => setShowCashDetail(false)}
      />

      <AdminConfirmModal
        open={showTrashAdvanceConfirm}
        title="Confirm Trash Advance"
        description={`This creates a cashflow expense for ${derived.needAdvanceCount} unpaid trash members.`}
        confirmText="Advance Trash"
        cancelText="Cancel"
        loading={advancingTrash}
        onCancel={() => !advancingTrash && setShowTrashAdvanceConfirm(false)}
        onConfirm={advanceTrash}
      >
        <div style={styles.confirmGrid}>
          <span>Period</span><strong>{periodLabel}</strong>
          <span>Total advance</span><strong>{money(derived.totalNeedAdvance)}</strong>
          <span>Projected balance</span><strong>{money(derived.currentBalance - derived.totalNeedAdvance)}</strong>
        </div>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={showReportConfirm}
        title="Confirm resident report delivery"
        description="Check the message before sending it to the WhatsApp group."
        confirmText="Send to Group"
        cancelText="Check Again"
        loading={sendingReport}
        onCancel={() => !sendingReport && setShowReportConfirm(false)}
        onConfirm={sendResidentReport}
      >
        <pre style={styles.previewBox}>{reportPreview}</pre>
      </AdminConfirmModal>
    </>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  section: { display: "grid", gap: 12 },
  panel: { display: "grid", gap: 20 },
  muted: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.5,
  },
  periodBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 800,
  },
  heroCard: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: 22,
    borderRadius: 20,
    border: "1px solid var(--admin-border)",
    background: "linear-gradient(135deg, var(--admin-card), var(--admin-row))",
    flexWrap: "wrap",
  },
  heroLabel: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  heroValue: {
    fontSize: "clamp(28px,5vw,44px)",
    fontWeight: 950,
    lineHeight: 1.1,
    margin: "8px 0",
  },
  heroBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    fontSize: 12,
    fontWeight: 900,
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
  },
  progressCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  progressValue: { fontSize: 22, fontWeight: 950, marginTop: 4 },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    background: "var(--admin-card)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "var(--admin-primary)",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  reportCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    border: "1px solid var(--admin-border)",
    borderRadius: 16,
    background: "var(--admin-row)",
    flexWrap: "wrap",
  },
  quickActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
    gap: 10,
  },
  quickAction: {
    display: "grid",
    gap: 4,
    padding: 14,
    textAlign: "left",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    cursor: "pointer",
  },
  alertList: { display: "grid", gap: 10 },
  alertItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 14,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    flexWrap: "wrap",
  },
  cashflowList: { display: "grid", gap: 8 },
  cashflowItem: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: 12,
    padding: 12,
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    background: "var(--admin-row)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    width: "100%",
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  memberList: {
    display: "grid",
    gap: 8,
    maxHeight: "55vh",
    overflow: "auto",
  },
  memberItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
  },
  confirmGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
  },
  previewBox: {
    margin: 0,
    padding: 14,
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    background: "var(--admin-row)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  },
  formatChoiceDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 6,
    minWidth: 260,
    background: "var(--admin-card)",
    border: "1px solid var(--admin-border)",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 100,
    overflow: "hidden",
    display: "grid",
    gap: 2,
    padding: 4,
  },
  formatChoiceOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "10px 12px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "var(--admin-text)",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s",
    width: "100%",
  },
  formatChoiceIcon: {
    fontSize: 22,
    lineHeight: 1,
    flex: "0 0 auto",
    marginTop: 2,
  },
};
