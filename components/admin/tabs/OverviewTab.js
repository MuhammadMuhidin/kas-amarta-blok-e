"use client";

import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { shareMembersJpgReport } from "@/components/admin/exportMembersJpg";
import Toast from "@/components/Toast";
import { useEffect, useRef, useState } from "react";

const DETAIL_MODAL_PAGE_SIZE = 15;
const TRASH_MODAL_PAGE_SIZE = 5;
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
    align-items: flex-start;
    overflow-y: auto;
    padding: 18px 12px;
  }

  .admin-wrapper .modal-box {
    animation: adminModalContentIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: center;
    max-height: calc(100dvh - 36px);
    overflow-y: auto;
    position: relative;
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

  .admin-wrapper .pay-slider {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    scroll-snap-stop: always;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    padding-bottom: 8px;
    padding-inline: 1px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .admin-wrapper .pay-slider::-webkit-scrollbar {
    display: none;
  }

  .admin-wrapper .pay-slide-page {
    flex: 0 0 100%;
    min-width: 100%;
    scroll-snap-align: center;
    scroll-snap-stop: always;
  }

  .admin-wrapper .pay-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
  }

  .admin-wrapper .pay-dots span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--admin-border);
    transition: all .25s ease;
    cursor: pointer;
  }

  .admin-wrapper .pay-dots span.active {
    width: 22px;
    background: var(--admin-primary);
  }

  @keyframes adminModalOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes adminModalContentIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 640px) {
    .admin-wrapper .modal-overlay {
      padding: 12px 8px;
    }

    .admin-wrapper .modal-box {
      width: min(100%, calc(100vw - 16px));
      max-height: calc(100dvh - 24px);
      border-radius: 18px;
      padding: 16px;
      padding-top: 48px;
    }

    .admin-wrapper .modal-header {
      align-items: stretch;
      gap: 12px;
    }
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
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";
  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;
  return new Date(`${normalized}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function sortMembers(items) {
  return [...items].sort((a, b) => normalize(a.house).localeCompare(normalize(b.house), "id-ID", { numeric: true }));
}

function isPaidDetailType(type) {
  return String(type || "").endsWith("-paid");
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(value || 0) / Number(total || 0)) * 100)));
}

function chunkItems(items, pageSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += pageSize) {
    chunks.push(items.slice(index, index + pageSize));
  }
  return chunks.length ? chunks : [[]];
}

function getSnapPage(event, totalPages) {
  const width = event.currentTarget.clientWidth || 1;
  return Math.min(totalPages - 1, Math.max(0, Math.round(event.currentTarget.scrollLeft / width)));
}

function scrollToSnapPage(ref, page) {
  const slider = ref.current;
  if (!slider) return;
  slider.scrollTo({ left: slider.clientWidth * page, behavior: "smooth" });
}

function getTrashAdvanceRefId(personId, period) {
  return `TRASHADV-${normalize(personId)}-${normalize(period)}`;
}

function getTrashStatusLabel(person) {
  if (person.trashPaid) return "Paid";
  if (person.trashAdvanced) return "Advanced";
  return "Need Advance";
}

function getTrashStatusStyle(person) {
  if (person.trashPaid) return styles.trashStatusPaid;
  if (person.trashAdvanced) return styles.trashStatusAdvanced;
  return styles.trashStatusNeedAdvance;
}

function Section({ title, children }) {
  return <section style={{ display: "grid", gap: 12 }}><h3 style={{ margin: 0 }}>{title}</h3>{children}</section>;
}

function QuickAction({ title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.quickActionCard}>
      <span style={styles.quickActionTitle}>{title}</span>
      <span style={styles.quickActionSubtitle}>{subtitle}</span>
    </button>
  );
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

function ModalCloseButton({ onClose }) {
  return <button type="button" style={styles.modalCloseButton} onClick={onClose} aria-label="Close modal">×</button>;
}

function PaymentDots({ totalPages, page, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pay-dots">
      {Array.from({ length: totalPages }).map((_, index) => (
        <span
          key={index}
          className={index === page ? "active" : ""}
          role="button"
          tabIndex={0}
          aria-label={`Go to page ${index + 1}`}
          onClick={() => onChange(index)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChange(index);
            }
          }}
        />
      ))}
    </div>
  );
}

function DetailMembersModal({ open, title, members, statusText, emptyText, shareLabel = "Share JPG", sharing = false, onShareJpg, onClose }) {
  useModalScrollLock(open);
  const [page, setPage] = useState(0);
  const sliderRef = useRef(null);
  const pages = chunkItems(members, DETAIL_MODAL_PAGE_SIZE);

  useEffect(() => {
    if (!open) return;
    setPage(0);
    sliderRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [open, members.length]);

  if (!open) return null;

  function handleDotChange(nextPage) {
    setPage(nextPage);
    scrollToSnapPage(sliderRef, nextPage);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        <div className="modal-header">
          <div style={styles.modalTitleGroup}>
            <div className="modal-title">{title}</div>
            <div className="modal-section">{members.length} houses {statusText}.</div>
          </div>
          <div style={styles.modalActions}>
            {onShareJpg && (
              <AdminActionButton loading={sharing} loadingText="Creating JPG..." disabled={members.length === 0} onClick={onShareJpg}>{shareLabel}</AdminActionButton>
            )}
          </div>
        </div>

        <div
          ref={sliderRef}
          className="pay-slider"
          onScroll={(event) => setPage(getSnapPage(event, pages.length))}
        >
          {pages.map((pageItems, pageIndex) => (
            <div className="pay-slide-page" key={pageIndex}>
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
                  ) : pageItems.map((person, index) => (
                    <tr key={person.id || `${person.house}-${pageIndex}-${index}`}>
                      <td>{pageIndex * DETAIL_MODAL_PAGE_SIZE + index + 1}</td>
                      <td>{person.house || "-"}</td>
                      <td>{person.name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <PaymentDots totalPages={pages.length} page={page} onChange={handleDotChange} />
      </div>
    </div>
  );
}

function TrashAllMembersModal({
  open,
  periodLabel,
  members,
  paidCount,
  needAdvanceCount,
  advancedCount,
  totalNeedAdvance,
  totalAdvanced,
  sharing,
  advancing,
  onShareJpg,
  onAdvance,
  onClose,
}) {
  useModalScrollLock(open);
  const [page, setPage] = useState(0);
  const sliderRef = useRef(null);
  const pages = chunkItems(members, TRASH_MODAL_PAGE_SIZE);

  useEffect(() => {
    if (!open) return;
    setPage(0);
    sliderRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [open, members.length]);

  if (!open) return null;

  function handleDotChange(nextPage) {
    setPage(nextPage);
    scrollToSnapPage(sliderRef, nextPage);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        <div className="modal-header">
          <div style={styles.modalTitleGroup}>
            <div className="modal-title">All Trash Payment Details</div>
            <div className="modal-section">{members.length} trash members for {periodLabel}.</div>
          </div>
          <div style={styles.trashModalActions}>
            <AdminActionButton loading={sharing} loadingText="Creating JPG..." disabled={members.length === 0 || advancing} onClick={onShareJpg}>Share JPG</AdminActionButton>
            <AdminActionButton loading={advancing} loadingText="Advancing..." disabled={needAdvanceCount === 0 || sharing} onClick={onAdvance}>Advance Unpaid Trash</AdminActionButton>
          </div>
        </div>

        <div style={styles.trashSummaryGrid}>
          <div style={styles.trashSummaryItem}><span>Total Members</span><strong>{members.length}</strong></div>
          <div style={styles.trashSummaryItem}><span>Paid</span><strong style={{ color: "#16a34a" }}>{paidCount}</strong></div>
          <div style={styles.trashSummaryItem}><span>Need Advance</span><strong style={{ color: "#d97706" }}>{needAdvanceCount}</strong></div>
          <div style={styles.trashSummaryItem}><span>Advanced</span><strong style={{ color: "#dc2626" }}>{advancedCount}</strong></div>
        </div>
        <div style={styles.trashAdvanceNote}>
          Need to advance: <strong>{money(totalNeedAdvance)}</strong><br />
          Already advanced by cash: <strong>{money(totalAdvanced)}</strong>
        </div>

        <div
          ref={sliderRef}
          className="pay-slider"
          onScroll={(event) => setPage(getSnapPage(event, pages.length))}
        >
          {pages.map((pageItems, pageIndex) => (
            <div className="pay-slide-page" key={pageIndex}>
              <div style={styles.trashMemberList}>
                {members.length === 0 ? (
                  <div className="admin-empty-state">No trash member data.</div>
                ) : pageItems.map((person, index) => (
                  <div key={person.id || `${person.house}-${pageIndex}-${index}`} style={styles.trashMemberItem}>
                    <div style={styles.trashMemberNo}>{pageIndex * TRASH_MODAL_PAGE_SIZE + index + 1}</div>
                    <div style={styles.trashMemberMain}>
                      <div style={styles.trashMemberHouse}>{person.house || "-"}</div>
                      <div style={styles.trashMemberName}>{person.name || "-"}</div>
                    </div>
                    <span style={{ ...styles.trashStatusBadge, ...getTrashStatusStyle(person) }}>
                      {getTrashStatusLabel(person)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <PaymentDots totalPages={pages.length} page={page} onChange={handleDotChange} />
      </div>
    </div>
  );
}

function CashBalanceHero({ value }) {
  const negative = Number(value || 0) < 0;
  return (
    <section style={{ ...styles.heroCard, borderColor: negative ? "#dc2626" : "var(--admin-border)" }}>
      <div>
        <div style={styles.heroLabel}>Cash Balance</div>
        <div style={{ ...styles.heroValue, color: negative ? "#dc2626" : "var(--admin-text)" }}>{money(value)}</div>
        <div style={styles.heroMeta}>Income minus expenses across all periods.</div>
      </div>
      <div style={{ ...styles.heroBadge, color: negative ? "#dc2626" : "#16a34a" }}>{negative ? "Need Review" : "Healthy"}</div>
    </section>
  );
}

function ProgressCard({ label, paid, total, unpaid, metaActions = [], error = false }) {
  const percent = getPercent(paid, total);
  return (
    <div style={{ ...styles.progressCard, borderColor: error ? "#d97706" : "var(--admin-border)" }}>
      <div style={styles.progressHeader}>
        <div>
          <div style={styles.progressLabel}>{label}</div>
          <div style={styles.progressValue}>{paid}/{total} houses</div>
        </div>
        <div style={{ ...styles.progressPercent, color: error ? "#d97706" : "#16a34a" }}>{percent}%</div>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${percent}%` }} />
      </div>
      <div style={styles.progressMetaRow}>
        <span>{unpaid} houses unpaid.</span>
        <span>{paid} houses paid.</span>
      </div>
      <div style={styles.progressActions}>
        {metaActions.filter(Boolean).map((action) => (
          <button key={action.label} type="button" style={styles.progressActionButton} onClick={action.onClick}>{action.label}</button>
        ))}
      </div>
    </div>
  );
}

function CompactCashflowItem({ item }) {
  const isIncome = item.type === "income";
  const label = isIncome ? "Income" : "Expense";
  return (
    <div style={styles.cashflowItem}>
      <span style={{ ...styles.cashflowBadge, color: isIncome ? "#16a34a" : "#dc2626" }}>{label}</span>
      <span style={styles.cashflowNote}>{item.note || "-"}</span>
      <span aria-hidden="true" />
      <span style={styles.cashflowAmount}>{money(item.amount)}</span>
      <span aria-hidden="true" />
      <span style={styles.cashflowDate}>{formatDate(item.date)}</span>
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
  const [sendingReport, setSendingReport] = useState(false);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [reportPreview, setReportPreview] = useState("");
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [unpaidDetail, setUnpaidDetail] = useState(null);
  const [showPaidTrashDetail, setShowPaidTrashDetail] = useState(false);
  const [showAllTrashDetail, setShowAllTrashDetail] = useState(false);
  const [advancingTrash, setAdvancingTrash] = useState(false);
  const [exportingDetailJpg, setExportingDetailJpg] = useState("");
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  useModalScrollLock(showReportConfirm);

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
  const trashAdvanceRefIds = new Set(cashflows.map((item) => normalize(item.ref_id)).filter((refId) => refId.startsWith("TRASHADV-") && refId.endsWith(`-${currentPeriod}`)));
  const paidCurrentTrashMembers = sortMembers(activeCurrentTrashMembers.filter((person) => trashPaidPersonIds.has(normalize(person.id))));
  const paidCurrentTrashCount = paidCurrentTrashMembers.length;
  const unpaidCurrentTrashMembers = sortMembers(activeCurrentTrashMembers.filter((person) => !trashPaidPersonIds.has(normalize(person.id))));
  const unpaidCurrentTrashCount = unpaidCurrentTrashMembers.length;
  const allTrashMembers = sortMembers(activeCurrentTrashMembers).map((person) => {
    const personId = normalize(person.id);
    const trashPaid = trashPaidPersonIds.has(personId);
    const trashAdvanced = !trashPaid && trashAdvanceRefIds.has(getTrashAdvanceRefId(personId, currentPeriod));

    return { ...person, trashPaid, trashAdvanced, status: trashPaid ? "Paid" : trashAdvanced ? "Advanced" : "Need Advance" };
  });
  const needAdvanceTrashCount = allTrashMembers.filter((person) => !person.trashPaid && !person.trashAdvanced).length;
  const advancedTrashCount = allTrashMembers.filter((person) => person.trashAdvanced).length;
  const totalNeedAdvanceTrash = needAdvanceTrashCount * Number(appConfig?.trash_fee || 0);
  const totalAdvancedTrash = advancedTrashCount * Number(appConfig?.trash_fee || 0);
  const allIncome = cashflows.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allExpense = cashflows.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentBalance = allIncome - allExpense;
  const readyBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "pending");
  const waitingBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "waiting");
  const backupOk = Boolean(dailyBackup?.ok);
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

  async function handleShareAllTrashJpg() {
    if (exportingDetailJpg) return;
    setExportingDetailJpg("sampah-all");
    try {
      const result = await shareMembersJpgReport({
        title: "Trash Payment Report",
        period: currentPeriod,
        members: allTrashMembers,
        summaryItems: [
          ["Members", `${allTrashMembers.length} houses`, "Trash registered"],
          ["Paid", `${paidCurrentTrashCount} houses`, "Already paid"],
          ["Need", money(totalNeedAdvanceTrash), `${needAdvanceTrashCount} houses`],
        ],
        badgeText: "TRASH REPORT",
        listTitle: "Trash Member Status",
        noteText: "Paid = already paid. Need Advance = not yet advanced. Advanced = temporarily paid by cash.",
        footerNote: `Already advanced by cash: ${money(totalAdvancedTrash)} from ${advancedTrashCount} houses.`,
        fileName: `trash-payment-all-${currentPeriod}.jpg`,
      });
      showToast("success", result === "shared" ? "JPG is ready to share." : "JPG downloaded successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to create JPG.");
    } finally {
      setExportingDetailJpg("");
    }
  }

  async function handleAdvanceUnpaidTrash() {
    if (advancingTrash || needAdvanceTrashCount === 0) return;
    setAdvancingTrash(true);
    try {
      const data = await sendJson("/api/sheets/trash/advance-bulk", "POST", { period: currentPeriod });
      await onTrashAdvanceComplete?.();
      showToast("success", `Advanced ${data.advanced || 0} trash expenses. Total ${money(data.total || 0)}.`);
    } catch (err) {
      showToast("error", err.message || "Failed to advance unpaid trash.");
    } finally {
      setAdvancingTrash(false);
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

        <CashBalanceHero value={currentBalance} />

        <Section title="Payment Progress">
          <div style={styles.twoColumnGrid}>
            <ProgressCard
              label="Cash Payment"
              paid={paidCurrentCount}
              total={activeCurrentMembers.length}
              unpaid={unpaidCurrentCount}
              metaActions={[
                unpaidCurrentCount > 0 ? { label: "View Unpaid", onClick: () => setUnpaidDetail({ type: "kas-unpaid", title: "Unpaid Cash Details", members: unpaidCurrentMembers }) } : null,
                paidCurrentCount > 0 ? { label: "View Paid", onClick: () => setUnpaidDetail({ type: "kas-paid", title: "Paid Cash Details", members: paidCurrentMembers }) } : null,
              ]}
              error={unpaidCurrentCount > 0}
            />
            <ProgressCard
              label="Trash Payment"
              paid={paidCurrentTrashCount}
              total={activeCurrentTrashMembers.length}
              unpaid={unpaidCurrentTrashCount}
              metaActions={[
                unpaidCurrentTrashCount > 0 ? { label: "View Unpaid", onClick: () => setUnpaidDetail({ type: "sampah-unpaid", title: "Unpaid Trash Details", members: unpaidCurrentTrashMembers }) } : null,
                { label: "View Paid", onClick: () => setShowPaidTrashDetail(true) },
                { label: "View All", onClick: () => setShowAllTrashDetail(true) },
              ]}
              error={unpaidCurrentTrashCount > 0}
            />
          </div>
        </Section>

        <Section title="Action Status">
          <div className="admin-monitor-grid">
            <MonitoringCard label="Ready Booking" value={`${readyBookings.length} houses`} meta={[`${waitingBookings.length} bookings waiting for the payment period.`]} error={readyBookings.length > 0} />
            <MonitoringCard label="Monitoring Issue" value={`${monitoringIssueCount} issue`} meta={[monitoringIssueCount ? "Need review" : "No issue detected"]} error={monitoringIssueCount > 0} />
          </div>
        </Section>

        <Section title="Resident Report">
          <div style={styles.reportCard}>
            <div>
              <div style={styles.reportTitle}>WhatsApp Cash Report</div>
              <div style={styles.reportDetail}>Preview the monthly cash report before sending it to the resident group.</div>
            </div>
            <AdminActionButton onClick={openResidentReportConfirm} loading={loadingReportPreview} loadingText="Loading preview..." disabled={sendingReport}>Preview & Send WhatsApp Report</AdminActionButton>
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
          {alerts.length === 0 ? <div className="admin-empty-state">No special attention needed. The system looks stable.</div> : <div style={styles.alertList}>{alerts.map((alert) => <AlertItem key={alert.title} tone={alert.tone} title={alert.title} detail={alert.detail} action={alert.action} onClick={() => onNavigate(alert.tab)} />)}</div>}
        </Section>

        <Section title="Recent Cashflow">
          {recentCashflows.length === 0 ? <div className="admin-empty-state">No cashflow transactions yet.</div> : (
            <div style={styles.cashflowList}>{recentCashflows.map((item) => <CompactCashflowItem key={item.id || `${item.date}-${item.note}-${item.amount}`} item={item} />)}</div>
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
      <TrashAllMembersModal
        open={showAllTrashDetail}
        periodLabel={periodLabel}
        members={allTrashMembers}
        paidCount={paidCurrentTrashCount}
        needAdvanceCount={needAdvanceTrashCount}
        advancedCount={advancedTrashCount}
        totalNeedAdvance={totalNeedAdvanceTrash}
        totalAdvanced={totalAdvancedTrash}
        sharing={exportingDetailJpg === "sampah-all"}
        advancing={advancingTrash}
        onShareJpg={handleShareAllTrashJpg}
        onAdvance={handleAdvanceUnpaidTrash}
        onClose={() => setShowAllTrashDetail(false)}
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
  modalTitleGroup: { minWidth: 0, flex: "1 1 220px", paddingRight: 46 },
  modalActions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", paddingRight: 46 },
  modalCloseButton: { position: "absolute", top: 12, right: 12, zIndex: 3, width: 36, height: 36, borderRadius: 999, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", cursor: "pointer", fontSize: 24, fontWeight: 900, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  heroCard: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 22, borderRadius: 20, border: "1px solid var(--admin-border)", background: "linear-gradient(135deg, var(--admin-card), var(--admin-row))", flexWrap: "wrap" },
  heroLabel: { color: "var(--admin-muted)", fontSize: 13, fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" },
  heroValue: { fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 950, lineHeight: 1.1, marginTop: 8 },
  heroMeta: { color: "var(--admin-muted)", fontSize: 13, fontWeight: 650, lineHeight: 1.55, marginTop: 8 },
  heroBadge: { padding: "8px 12px", borderRadius: 999, background: "var(--admin-row)", border: "1px solid var(--admin-border)", fontSize: 12, fontWeight: 900 },
  twoColumnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  progressCard: { padding: 16, borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)", display: "grid", gap: 12 },
  progressHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  progressLabel: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" },
  progressValue: { color: "var(--admin-text)", fontSize: 22, fontWeight: 950, marginTop: 4 },
  progressPercent: { fontSize: 18, fontWeight: 950 },
  progressTrack: { height: 9, borderRadius: 999, background: "var(--admin-card)", overflow: "hidden", border: "1px solid var(--admin-border)" },
  progressFill: { height: "100%", borderRadius: 999, background: "var(--admin-primary)", transition: "width 0.2s ease" },
  progressMetaRow: { display: "flex", justifyContent: "space-between", gap: 8, color: "var(--admin-muted)", fontSize: 12, fontWeight: 700, flexWrap: "wrap" },
  progressActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  progressActionButton: { border: "none", background: "none", color: "var(--admin-primary)", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 800, padding: 0 },
  quickActions: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  quickActionCard: { display: "grid", gap: 4, textAlign: "left", padding: 14, borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", cursor: "pointer" },
  quickActionTitle: { fontSize: 14, fontWeight: 950 },
  quickActionSubtitle: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 650 },
  reportCard: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 16, borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)", flexWrap: "wrap" },
  reportTitle: { fontSize: 15, fontWeight: 900, marginBottom: 4 },
  reportDetail: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  previewBox: { margin: 0, padding: 14, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-text)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  alertList: { display: "grid", gap: 10 },
  alertItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)", flexWrap: "wrap" },
  alertTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  alertDetail: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  trashModalActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", paddingRight: 46 },
  trashSummaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "12px 0" },
  trashSummaryItem: { display: "grid", gap: 6, padding: 12, borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)", minWidth: 0 },
  trashAdvanceNote: { margin: "6px 0 12px", padding: 12, borderRadius: 14, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontSize: 13, fontWeight: 800, lineHeight: 1.5 },
  trashMemberList: { display: "grid", gap: 8, marginTop: 10, minHeight: 310 },
  trashMemberItem: { display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) auto", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--admin-border)", background: "var(--admin-row)" },
  trashMemberNo: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 900, textAlign: "center" },
  trashMemberMain: { minWidth: 0, display: "grid", gap: 2 },
  trashMemberHouse: { color: "var(--admin-text)", fontSize: 14, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  trashMemberName: { color: "var(--admin-muted)", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  trashStatusBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  trashStatusPaid: { background: "#dcfce7", color: "#16a34a" },
  trashStatusAdvanced: { background: "#fee2e2", color: "#dc2626" },
  trashStatusNeedAdvance: { background: "#fef3c7", color: "#d97706" },
  cashflowList: { display: "grid", gap: 0, padding: "6px 14px", borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)" },
  cashflowItem: { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", alignItems: "center", columnGap: 10, rowGap: 4, padding: "12px 0", borderBottom: "1px solid var(--admin-border)" },
  cashflowBadge: { fontSize: 12, fontWeight: 950, alignSelf: "start", paddingTop: 1 },
  cashflowNote: { color: "var(--admin-text)", fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  cashflowAmount: { color: "var(--admin-text)", fontSize: 13, fontWeight: 950, whiteSpace: "nowrap" },
  cashflowDate: { color: "var(--admin-muted)", fontSize: 11, fontWeight: 700 },
};