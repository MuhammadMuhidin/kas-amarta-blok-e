"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson, readJson } from "@/components/admin/adminClientApi";
import { shareMembersJpgReport, shareMembersJpgReportMinimalist } from "@/components/admin/exportMembersJpg";
import Toast from "@/components/Toast";
import { addMonths } from "@/lib/depositUtils";
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

let modalScrollLockCount = 0;

const START_PERIOD = "2026-02";

function getEffectiveStart(joinPeriod) {
  if (!joinPeriod) return START_PERIOD;
  return joinPeriod >= START_PERIOD ? joinPeriod : START_PERIOD;
}

function formatPeriodShort(period) {
  if (!period || period === "-") return "-";
  const n = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(n)) return period;
  const d = new Date(`${n}-01`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Returns display string: "Jan, Feb, Mar [2026]" or "Jan, Feb [2025], Mar [2026]"
function formatPeriodsList(periods) {
  if (!periods.length) return "-";
  const byYear = {};
  periods.forEach((p) => {
    const y = p.slice(0, 4);
    const m = new Date(`${p}-01`).toLocaleDateString("en-US", { month: "short" });
    (byYear[y] ||= []).push(m);
  });
  const years = Object.keys(byYear).sort();
  if (years.length === 1) {
    return `${byYear[years[0]].join(", ")} [${years[0]}]`;
  }
  return years.map((y) => `${byYear[y].join(", ")} [${y}]`).join(", ");
}

function copyArrearsAsText(arrears, currentPeriod) {
  const lines = [
    `📋 ARREARS REPORT — ${formatPeriodShort(currentPeriod)}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `🏠 ${arrears.length} house${arrears.length === 1 ? "" : "s"} · 💰 ${money(arrears.reduce((s, a) => s + a.totalAmount, 0))}`,
    "",
  ];
  arrears.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.house} — ${a.name} — ${a.months} bulan`);
    lines.push(`   ${formatPeriodsList(a.periods)}`);
    lines.push(`   ${money(a.totalAmount)} · ${a.trash ? "Kas + Sampah" : "Kas"}`);
    lines.push("");
  });
  return lines.join("\n");
}

function useModalScrollLock(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    modalScrollLockCount += 1;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
      if (modalScrollLockCount === 0) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
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
        <div className="overview-progress-row-actions" style={styles.rowActions}>
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

function CashDetailModal({ open, status, periodLabel, paidCount, unpaidCount, totalPaidAmount, totalDueAmount, unpaidAmount, sharing, onShareFull, onShareMinimalist, onClose }) {
  useModalScrollLock(open);

  if (!open) return null;

  return <CashDetailModalInner
    status={status}
    periodLabel={periodLabel}
    paidCount={paidCount}
    unpaidCount={unpaidCount}
    totalPaidAmount={totalPaidAmount}
    totalDueAmount={totalDueAmount}
    unpaidAmount={unpaidAmount}
    sharing={sharing}
    onShareFull={onShareFull}
    onShareMinimalist={onShareMinimalist}
    onClose={onClose}
  />;
}

function CashDetailModalInner({ status, periodLabel, paidCount, unpaidCount, totalPaidAmount, totalDueAmount, unpaidAmount, sharing, onShareFull, onShareMinimalist, onClose }) {
  const [showFormatChoice, setShowFormatChoice] = useState(false);
  const [fetchedMembers, setFetchedMembers] = useState([]);
  const [fetchedTotal, setFetchedTotal] = useState(0);
  const [fetchError, setFetchError] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  useEffect(() => setShowFormatChoice(false), [sharing]);

  useEffect(() => {
    if (!status) return;
    let cancelled = false;
    async function fetchMembers() {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({ page: "1", limit: "100", status });
        const res = await fetch(`/api/sheets/payment/view?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        if (!cancelled) {
          setFetchedMembers(data.members || []);
          setFetchedTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        if (!cancelled) setFetchError(err.message);
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    }
    fetchMembers();
    return () => { cancelled = true; };
  }, [status]);

  if (fetchError) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Cash Payment Details</div>
            <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          </div>
          <div className="admin-error-box">{fetchError}</div>
        </div>
      </div>
    );
  }

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
                {fetchedTotal} members · {periodLabel} · {status === "paid" ? "Paid" : status === "unpaid" ? "Unpaid" : "All"}
              </div>
            </div>
            <button type="button" className="admin-small-btn" onClick={onClose}>Close</button>
          </div>
          <div style={styles.rowActions}>
            <div style={{ position: "relative" }}>
              <AdminActionButton
                loading={sharing}
                disabled={!fetchedMembers.length || sharing}
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
              className="admin-small-btn overview-cash-modal-refresh"
              disabled={fetchLoading}
              onClick={() => {
                setFetchedMembers([]);
                setFetchedTotal(0);
                setFetchError(null);
                setFetchLoading(true);
                const params = new URLSearchParams({ page: "1", limit: "100", status });
                fetch(`/api/sheets/payment/view?${params.toString()}`, { cache: "no-store" })
                  .then(res => res.json())
                  .then(data => {
                    if (!data.ok) throw new Error(data.error || "Failed to load");
                    setFetchedMembers(data.members || []);
                    setFetchedTotal(data.pagination?.total || 0);
                  })
                  .catch(err => setFetchError(err.message))
                  .finally(() => setFetchLoading(false));
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="admin-monitor-grid" style={{ marginBottom: 12 }}>
          <MonitoringCard label="Paid" value={money(totalPaidAmount)} meta={[`${paidCount} houses`]} />
          <MonitoringCard label="Unpaid" value={money(unpaidAmount)} meta={[`${unpaidCount} houses`]} />
        </div>
        <div style={styles.memberList}>
          {fetchedMembers.map((person) => (
            <div key={person.id} style={styles.memberItem}>
              <div>
                <strong>{person.house}</strong>
                <div style={styles.muted}>{person.name}</div>
              </div>
              <span>{person.paymentStatus}</span>
            </div>
          ))}
          {fetchLoading && <div className="admin-empty-state">Loading...</div>}
          {!fetchLoading && fetchedMembers.length === 0 && (
            <div className="admin-empty-state">No members found.</div>
          )}
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
  const [expandedArrears, setExpandedArrears] = useState({});
  const [waServicesEnabled, setWaServicesEnabled] = useState(true);
  const [loadingWaConfig, setLoadingWaConfig] = useState(true);

  useModalScrollLock(showReportConfirm || showTrashAdvanceConfirm || showCashDetail);

  useEffect(() => {
    loadAuthConfig();
  }, []);

  async function loadAuthConfig() {
    try {
      const data = await readJson("/api/admin/settings/status");
      setWaServicesEnabled(data.whatsapp_services_enabled === true);
    } catch {
      setWaServicesEnabled(false);
    } finally {
      setLoadingWaConfig(false);
    }
  }

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
        .filter((payment) => payment && String(payment.period || "").slice(0, 7) === currentPeriod)
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
      unpaidAmount: unpaidMembers.length * Number(appConfig?.monthly_fee || 0),
      membersWithPaymentStatus: activeCurrentMembers.map(member => ({
        ...member,
        paymentStatus: paidCurrentKeys.has(normalize(member.house)) || paidCurrentKeys.has(normalize(member.id)) ? 'Paid' : 'Unpaid',
      })),
      arrearsReport: (() => {
        const monthlyFee = Number(appConfig?.monthly_fee || 0);
        const trashFee = Number(appConfig?.trash_fee || 0);
        const allAdvanceRefIds = new Set(
          cashflows
            .map((item) => normalize(item.ref_id))
            .filter((refId) => refId.startsWith("TRASHADV-")),
        );
        const result = [];
        activeCurrentMembers.forEach((person) => {
          const start = getEffectiveStart(normalize(person.join_date).slice(0, 7));
          const periods = [];
          let p = start;
          while (p <= currentPeriod) {
            periods.push(p);
            p = addMonths(p, 1);
          }
          const paidCash = new Set(
            payments
              .filter((pay) => normalize(pay.person_id) === normalize(person.id) || normalize(pay.person_house) === normalize(person.house))
              .map((pay) => normalize(pay.period).slice(0, 7)),
          );
          const paidTrash = new Set(
            trashRecords
              .filter((tr) => normalize(tr.person_id) === normalize(person.id) || normalize(tr.house) === normalize(person.house))
              .map((tr) => normalize(tr.period).slice(0, 7)),
          );
          const unpaidPeriods = periods.filter((period) => !paidCash.has(period));
          if (!unpaidPeriods.length) return;
          const hasTrash = normalizeUpper(person.trash) === "Y";
          const personId = normalize(person.id);
          const unpaidDetail = unpaidPeriods.map((period) => {
            const hasAdvance = hasTrash && allAdvanceRefIds.has(getTrashAdvanceRefId(personId, period));
            return { period, hasAdvance };
          });
          const advancedCount = unpaidDetail.filter((d) => d.hasAdvance).length;
          const cashAmount = unpaidPeriods.length * monthlyFee;
          const trashAmount = hasTrash ? unpaidPeriods.length * trashFee : 0;
          const lastPaid = [...payments]
            .filter((pay) => (normalize(pay.person_id) === normalize(person.id) || normalize(pay.person_house) === normalize(person.house)) && normalize(pay.period).slice(0, 7) < currentPeriod)
            .sort((a, b) => normalize(b.period).localeCompare(normalize(a.period)))[0];
          result.push({
            id: person.id,
            house: person.house,
            name: person.name,
            trash: hasTrash,
            months: unpaidPeriods.length,
            periods: unpaidPeriods,
            unpaidDetail,
            advancedCount,
            cashAmount,
            trashAmount,
            totalAmount: cashAmount + trashAmount,
            lastPaid: lastPaid ? normalize(lastPaid.period).slice(0, 7) : "",
          });
        });
        result.sort((a, b) => b.months - a.months || a.house.localeCompare(b.house, undefined, { numeric: true }));
        return result;
      })(),
    };
  }, [personal, payments, trashRecords, cashflows, sortedDeposits, currentPeriod, appConfig, getDepositStatus]);

  function showToast(type, message) {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((current) => (
      current.message === message ? { ...current, show: false } : current
    )), 2800);
  }

   async function copyArrearsText() {
    const text = copyArrearsAsText(derived.arrearsReport, currentPeriod);
    try {
      await navigator.clipboard.writeText(text);
      showToast("success", "Arrears report copied to clipboard.");
    } catch {
      showToast("error", "Failed to copy. Please select and copy manually.");
    }
  }

  function toggleArrears(id) {
    setExpandedArrears((prev) => ({ ...prev, [id]: !prev[id] }));
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
            { value: "reporting", label: "Reporting", badge: derived.arrearsReport.length || null, panelId: "overview-reporting-panel" },
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
                    derived.unpaidMembers.length > 0
                      ? derived.paidMembers.length > 0 && {
                          label: "View Paid",
                          onClick: () => {
                            setCashDetailStatus("paid");
                            setShowCashDetail(true);
                          },
                        }
                      : {
                          label: "View All",
                          onClick: () => {
                            setCashDetailStatus("all");
                            setShowCashDetail(true);
                          },
                        },
                    derived.unpaidMembers.length > 0 && {
                      label: "View Unpaid",
                      onClick: () => {
                        setCashDetailStatus("unpaid");
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
                    { label: "View All", onClick: () => setShowTrashDetail(true) },
                    derived.unpaidTrashMembers.length > 0 && { label: "View Unpaid", onClick: () => setMemberDetail({ id: "trash-unpaid", title: "Unpaid Trash Details", members: derived.unpaidTrashMembers, totalMembers: derived.activeTrashMembers.length, statusText: "Unpaid", paymentLabel: "Trash", amount: appConfig?.trash_fee, note: "Houses that have not paid trash fees." }) },
                    derived.paidTrashMembers.length > 0 && { label: "View Paid", onClick: () => setMemberDetail({ id: "trash-paid", title: "Paid Trash Details", members: derived.paidTrashMembers, totalMembers: derived.activeTrashMembers.length, statusText: "Paid", paymentLabel: "Trash", amount: appConfig?.trash_fee, note: "Houses that have paid trash fees." }) },
                  ].filter(Boolean)}
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

        {activePanel === "reporting" && (
          <div id="overview-reporting-panel" role="tabpanel" style={styles.panel}>
            <Section title="Arrears Report">
              {derived.arrearsReport.length === 0 ? (
                <div className="admin-empty-state">No houses with arrears. All paid.</div>
              ) : (
                <>
                  <div style={styles.arrearsSummary}>
                    <span>🏠 {derived.arrearsReport.length} house{derived.arrearsReport.length === 1 ? "" : "s"} with total {money(derived.arrearsReport.reduce((s, a) => s + a.totalAmount, 0))}</span>
                  </div>
                  <div style={styles.arrearsCardList}>
                    {derived.arrearsReport.map((a, index) => (
                      <div key={a.id} style={{ ...styles.arrearsCard, cursor: "pointer" }} onClick={() => toggleArrears(a.id)}>
                        <div style={styles.arrearsCardHead}>
                          <strong>{index + 1}. {a.house} ({a.name})</strong>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {a.advancedCount > 0 && <span style={styles.arrearsAdvancedBadge}>⚡ {a.advancedCount} advanced</span>}
                            <span style={styles.arrearsCardBadge}>{a.months} bulan</span>
                          </div>
                        </div>
                        <div style={styles.arrearsCardBody}>
                          <span>Nunggak: {formatPeriodsList(a.periods)}</span>
                          <div style={styles.arrearsCardFoot}>
                            <span style={{ fontWeight: 800 }}>Total: {money(a.totalAmount)}</span>
                            <span style={a.trash ? styles.arrearsTrashBadgeCashTrash : styles.arrearsTrashBadgeCash}>{a.trash ? "Kas + Sampah" : "Kas"}</span>
                          </div>
                        </div>
                        {expandedArrears[a.id] && (
                          <div style={styles.arrearsDetail}>
                            {a.unpaidDetail.map((d) => (
                              <div key={d.period} style={styles.arrearsDetailRow}>
                                <span>{formatPeriodShort(d.period)}</span>
                                <span>{d.hasAdvance ? <span style={{ color: "#d97706" }}>⚡ Advanced</span> : <span style={{ color: "#dc2626" }}>❌ Unpaid</span>}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={styles.arrearsActions}>
                    <button type="button" className="admin-small-btn" onClick={copyArrearsText}>
                      Copy as Text
                    </button>
                  </div>
                </>
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
        unpaidAmount={derived.unpaidAmount}
        sharing={exportingDetailJpg === "cash-detail"}
        onShareFull={() => {
          setExportingDetailJpg("cash-detail");
          const isAll = cashDetailStatus === "all";
          const members = isAll
            ? derived.membersWithPaymentStatus
            : cashDetailStatus === "paid"
              ? derived.paidMembers.map(m => ({ ...m, paymentStatus: "Paid" }))
              : derived.unpaidMembers.map(m => ({ ...m, paymentStatus: "Unpaid" }));
          const detail = {
            id: "cash-detail",
            paymentLabel: "Cash",
            statusText: isAll ? "All" : cashDetailStatus === "paid" ? "Paid" : "Unpaid",
            members,
            totalMembers: derived.activeCurrentMembers.length,
            amount: appConfig?.monthly_fee,
            note: isAll
              ? "Paid and unpaid cash member status."
              : cashDetailStatus === "paid"
                ? "Houses that have paid cash dues."
                : "Houses that have not paid cash dues.",
          };
          shareDetail(detail, "full").finally(() => setExportingDetailJpg(""));
        }}
        onShareMinimalist={() => {
          setExportingDetailJpg("cash-detail");
          const isAll = cashDetailStatus === "all";
          const members = isAll
            ? derived.membersWithPaymentStatus
            : cashDetailStatus === "paid"
              ? derived.paidMembers.map(m => ({ ...m, paymentStatus: "Paid" }))
              : derived.unpaidMembers.map(m => ({ ...m, paymentStatus: "Unpaid" }));
          const detail = {
            id: "cash-detail",
            paymentLabel: "Cash",
            statusText: isAll ? "All" : cashDetailStatus === "paid" ? "Paid" : "Unpaid",
            members,
            totalMembers: derived.activeCurrentMembers.length,
            amount: appConfig?.monthly_fee,
            note: isAll
              ? "Paid and unpaid cash member status."
              : cashDetailStatus === "paid"
                ? "Houses that have paid cash dues."
                : "Houses that have not paid cash dues.",
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
        description={waServicesEnabled
          ? "Check the message before sending it to the WhatsApp group."
          : "Check the message. WhatsApp services are disabled — send manually."}
        confirmText="Send to Group"
        hideConfirm={loadingWaConfig || !waServicesEnabled}
        cancelText="Close"
        loading={sendingReport}
        onCancel={() => !sendingReport && setShowReportConfirm(false)}
        onConfirm={sendResidentReport}
      >
        <div style={styles.previewBoxWrap}>
          <pre style={styles.previewBox}>{reportPreview}</pre>
          <button
            type="button"
            className="admin-small-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reportPreview);
                showToast("success", "Report preview copied to clipboard.");
              } catch {
                showToast("error", "Failed to copy. Please select and copy manually.");
              }
            }}
            style={{ marginTop: 8 }}
          >
            Copy Text
          </button>
        </div>
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
  rowActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(min(140px,100%),1fr))",
    gap: 8,
  },
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
  previewBoxWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  formatChoiceDropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 6,
    minWidth: 220,
    maxWidth: "calc(100vw - 32px)",
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
  arrearsSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 14,
  },
  arrearsCardList: {
    display: "grid",
    gap: 10,
  },
  arrearsCard: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-card)",
  },
  arrearsCardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    fontSize: 14,
  },
  arrearsCardBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  arrearsAdvancedBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  arrearsDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid var(--admin-border)",
    display: "grid",
    gap: 4,
  },
  arrearsDetailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    padding: "2px 0",
  },
  arrearsCardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 13,
    color: "var(--admin-muted)",
  },
  arrearsCardFoot: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    fontWeight: 800,
    color: "var(--admin-text)",
  },
  arrearsTrashBadge: {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  arrearsTrashBadgeCash: {
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--admin-muted)",
    whiteSpace: "nowrap",
  },
  arrearsTrashBadgeCashTrash: {
    padding: "2px 8px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 700,
    color: "#1d4ed8",
    whiteSpace: "nowrap",
  },
  arrearsActions: {
    marginTop: 14,
    display: "flex",
    gap: 8,
  },
};
