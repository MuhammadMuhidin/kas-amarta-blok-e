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
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes adminModalContentIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .admin-wrapper .modal-overlay,
    .admin-wrapper .modal-box {
      animation: none;
    }
  }
`;

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPeriod(period) {
  if (!period || period === "-") return "-";

  const normalized = String(period).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return period;

  return new Date(`${normalized}-01`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function sortMembers(items) {
  return [...items].sort((a, b) =>
    normalize(a.house).localeCompare(normalize(b.house), "id-ID", { numeric: true }),
  );
}

function Section({ title, children }) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
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
            <div className="modal-section">{members.length} rumah {statusText}.</div>
          </div>
          {onShareJpg && (
            <AdminActionButton loading={sharing} loadingText="Membuat JPG..." disabled={members.length === 0} onClick={onShareJpg}>
              {shareLabel}
            </AdminActionButton>
          )}
        </div>

        <table className="detail-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Rumah</th>
              <th>Nama</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={3}>{emptyText}</td>
              </tr>
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
      showToast("error", err.message || "Gagal memuat preview rekap.");
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
      showToast("success", "Rekap berhasil dikirim ke grup WhatsApp.");
    } catch (err) {
      showToast("error", err.message || "Gagal mengirim rekap ke grup.");
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
  const paidCurrentKeys = new Set(
    payments
      .filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod)
      .map((payment) => normalize(payment.person_house || payment.house || payment.person_id)),
  );
  const paidCurrentCount = activeCurrentMembers.filter((person) => paidCurrentKeys.has(normalize(person.house))).length;
  const paidCurrentMembers = sortMembers(activeCurrentMembers.filter((person) => paidCurrentKeys.has(normalize(person.house))));
  const unpaidCurrentMembers = sortMembers(activeCurrentMembers.filter((person) => !paidCurrentKeys.has(normalize(person.house))));
  const unpaidCurrentCount = unpaidCurrentMembers.length;
  const trashPaidPersonIds = new Set(
    trashRecords
      .map((trash) => paymentById.get(normalize(trash.payment_id)))
      .filter((payment) => payment && String(payment.date || "").slice(0, 7) === currentPeriod)
      .map((payment) => normalize(payment.person_id))
      .filter(Boolean),
  );
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

    const isTrashPayment = paymentLabel === "Sampah";
    const isPaidStatus = statusText === "Sudah Bayar";

    try {
      const result = await shareMembersJpgReport({
        title: isTrashPayment ? "Pembayaran Iuran Sampah" : "Pembayaran Kas",
        period: currentPeriod,
        members,
        summaryItems: [
          ["Tercatat", `${members.length}/${totalMembers} rumah`, isPaidStatus ? "Sudah lunas" : "Belum lunas"],
          ["Tarif", money(amount), "per rumah"],
          ["Total", money(members.length * Number(amount || 0)), "dana tercatat"],
        ],
        badgeText: isPaidStatus ? "LUNAS" : "BELUM",
        listTitle: "Daftar Rumah",
        noteText: isTrashPayment
          ? `Berikut ini daftar rumah yang ${isPaidStatus ? "sudah membayar iuran sampah" : "belum membayar iuran sampah"}.`
          : `Berikut ini daftar rumah yang ${isPaidStatus ? "sudah membayar kas" : "belum membayar kas"}.`,
        footerNote,
        fileName: `${paymentLabel.toLowerCase()}-${statusText.toLowerCase().replaceAll(" ", "-")}-${currentPeriod}.jpg`,
      });

      showToast("success", result === "shared" ? "JPG siap dibagikan." : "JPG berhasil diunduh.");
    } catch (err) {
      showToast("error", err.message || "Gagal membuat JPG.");
    } finally {
      setExportingDetailJpg("");
    }
  }

  const alerts = [
    unpaidCurrentCount > 0 && {
      tone: "warning",
      title: `${unpaidCurrentCount} rumah belum bayar kas bulan ini`,
      detail: `Periode ${periodLabel} masih perlu ditagih atau dicek.`,
      action: "Buka Payment",
      tab: "payment",
    },
    unpaidCurrentTrashCount > 0 && {
      tone: "warning",
      title: `${unpaidCurrentTrashCount} rumah belum bayar sampah bulan ini`,
      detail: `Periode ${periodLabel} masih perlu ditagih atau dicek.`,
      action: "Buka Payment",
      tab: "payment",
    },
    readyBookings.length > 0 && {
      tone: "info",
      title: `${readyBookings.length} booking ready to pay`,
      detail: "Ada booking payment yang siap dibayarkan.",
      action: "Buka Booking",
      tab: "deposit",
    },
    monitoringIssueCount > 0 && {
      tone: "danger",
      title: `${monitoringIssueCount} issue monitoring`,
      detail: "Ada data integrity atau kualitas data yang perlu dicek.",
      action: "Buka Monitoring",
      tab: "monitoring",
    },
    !backupOk && {
      tone: "danger",
      title: "Backup belum sehat",
      detail: "Status backup harian belum valid atau belum ditemukan.",
      action: "Buka Monitoring",
      tab: "monitoring",
    },
  ].filter(Boolean);

  return (
    <>
      <style>{overviewAdminCss}</style>
      <Toast show={toast.show} type={toast.type} message={toast.message} />

      <div className="admin-card" style={{ display: "grid", gap: 22 }}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Overview</h2>
            <div style={styles.muted}>Ringkasan operasional kas, pembayaran, booking, dan kesehatan sistem.</div>
          </div>
          <div style={styles.periodBadge}>{periodLabel}</div>
        </div>

        <Section title="Quick Summary">
          <div className="admin-monitor-grid">
            <MonitoringCard label="Saldo Kas" value={money(currentBalance)} meta={["Income dikurangi expense semua periode."]} error={currentBalance < 0} />
            <MonitoringCard label="Pemasukan Bulan Ini" value={money(currentIncome)} meta={[`Periode ${periodLabel}`]} />
            <MonitoringCard label="Pengeluaran Bulan Ini" value={money(currentExpense)} meta={[`Periode ${periodLabel}`]} />
            <MonitoringCard label="Pembayaran Bulan Ini (Kas)" value={`${paidCurrentCount}/${activeCurrentMembers.length} rumah`} meta={[`${unpaidCurrentCount} rumah belum bayar.`, `${paidCurrentCount} rumah sudah bayar.`]} metaActions={[unpaidCurrentCount > 0 ? { label: "Lihat detail", onClick: () => setUnpaidDetail({ type: "kas-unpaid", title: "Detail Belum Bayar Kas", members: unpaidCurrentMembers }) } : null, paidCurrentCount > 0 ? { label: "Lihat detail", onClick: () => setUnpaidDetail({ type: "kas-paid", title: "Detail Sudah Bayar Kas", members: paidCurrentMembers }) } : null]} error={unpaidCurrentCount > 0} />
            <MonitoringCard label="Pembayaran Bulan Ini (Sampah)" value={`${paidCurrentTrashCount}/${activeCurrentTrashMembers.length} rumah`} meta={[`${unpaidCurrentTrashCount} rumah belum bayar.`, `${paidCurrentTrashCount} rumah sudah bayar.`]} metaActions={[unpaidCurrentTrashCount > 0 ? { label: "Lihat detail", onClick: () => setUnpaidDetail({ type: "sampah-unpaid", title: "Detail Belum Bayar Sampah", members: unpaidCurrentTrashMembers }) } : null, { label: "Lihat detail", onClick: () => setShowPaidTrashDetail(true) }]} error={unpaidCurrentTrashCount > 0} />
            <MonitoringCard label="Ready Booking" value={`${readyBookings.length} rumah`} meta={[`${waitingBookings.length} booking menunggu periode bayar.`]} error={readyBookings.length > 0} />
            <MonitoringCard label="Monitoring Issue" value={`${monitoringIssueCount} issue`} meta={[monitoringIssueCount ? "Need review" : "No issue detected"]} error={monitoringIssueCount > 0} />
          </div>
        </Section>

        <Section title="Laporan Warga">
          <div style={styles.reportCard}>
            <div>
              <div style={styles.reportTitle}>Kirim rekap kas ke grup WhatsApp</div>
              <div style={styles.reportDetail}>Review isi pesan terlebih dulu sebelum dikirim ke grup warga.</div>
            </div>
            <AdminActionButton onClick={openResidentReportConfirm} loading={loadingReportPreview} loadingText="Memuat preview..." disabled={sendingReport}>Kirim Rekap ke Grup WhatsApp</AdminActionButton>
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
          {alerts.length === 0 ? (
            <div className="admin-empty-state">Tidak ada perhatian khusus. Sistem terlihat stabil.</div>
          ) : (
            <div style={styles.alertList}>
              {alerts.map((alert) => (
                <AlertItem key={alert.title} tone={alert.tone} title={alert.title} detail={alert.detail} action={alert.action} onClick={() => onNavigate(alert.tab)} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Operational Snapshot">
          <div className="admin-monitor-grid">
            <MonitoringCard label="App Config" value={configOk ? "Ready" : "Not ready"} meta={configOk ? [`Kas: ${money(appConfig.monthly_fee)}`, `Sampah: ${money(appConfig.trash_fee)}`] : ["Konfigurasi belum tersedia."]} error={!configOk} />
            <MonitoringCard label="Daily Backup" value={backupOk ? "Healthy" : "Need check"} meta={backupOk ? [`File: ${dailyBackup.name}`, `Retention: ${dailyBackup.count} backup files`] : ["Backup harian belum valid."]} error={!backupOk} />
            <MonitoringCard label="Member Aktif" value={`${activeMembers.length} rumah`} meta={[`${activeCurrentMembers.length} rumah aktif di periode ini.`]} />
          </div>
        </Section>

        <Section title="Recent Cashflow">
          {recentCashflows.length === 0 ? (
            <div className="admin-empty-state">Belum ada transaksi cashflow.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Tanggal</th>
                    <th className="admin-th">Type</th>
                    <th className="admin-th">Amount</th>
                    <th className="admin-th">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCashflows.map((item, index) => (
                    <tr key={item.id || index} className={index % 2 ? "admin-row-alt" : ""}>
                      <td className="admin-td">{formatDate(item.date)}</td>
                      <td className="admin-td">{item.type}</td>
                      <td className="admin-td">{money(item.amount)}</td>
                      <td className="admin-td">{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <DetailMembersModal
        open={Boolean(unpaidDetail)}
        title={unpaidDetail?.title || "Detail Pembayaran"}
        members={unpaidDetail?.members || []}
        statusText={unpaidDetail?.type?.endsWith("paid") ? "sudah bayar" : "belum bayar"}
        emptyText="Tidak ada data rumah."
        sharing={exportingDetailJpg === unpaidDetail?.type}
        onShareJpg={unpaidDetail ? () => handleShareDetailJpg({
          id: unpaidDetail.type,
          members: unpaidDetail.members,
          totalMembers: unpaidDetail.type?.startsWith("sampah") ? activeCurrentTrashMembers.length : activeCurrentMembers.length,
          statusText: unpaidDetail.type?.endsWith("paid") ? "Sudah Bayar" : "Belum Bayar",
          paymentLabel: unpaidDetail.type?.startsWith("sampah") ? "Sampah" : "Kas",
          amount: unpaidDetail.type?.startsWith("sampah") ? appConfig?.trash_fee : appConfig?.monthly_fee,
          footerNote: "Jika ada data kurang sesuai, silakan konfirmasi ke admin kas.",
        }) : undefined}
        onClose={() => setUnpaidDetail(null)}
      />
      <DetailMembersModal
        open={showPaidTrashDetail}
        title="Detail Sudah Bayar Sampah"
        members={paidCurrentTrashMembers}
        statusText="sudah bayar"
        emptyText="Belum ada rumah yang sudah bayar sampah bulan ini."
        sharing={exportingDetailJpg === "sampah-paid"}
        onShareJpg={() => handleShareDetailJpg({
          id: "sampah-paid",
          members: paidCurrentTrashMembers,
          totalMembers: activeCurrentTrashMembers.length,
          statusText: "Sudah Bayar",
          paymentLabel: "Sampah",
          amount: appConfig?.trash_fee,
          footerNote: "Jika ada data kurang sesuai, silakan konfirmasi ke admin kas.",
        })}
        onClose={() => setShowPaidTrashDetail(false)}
      />

      <AdminConfirmModal open={showReportConfirm} title="Konfirmasi kirim rekap warga" description="Pastikan isi pesan sudah benar sebelum dikirim ke grup WhatsApp." confirmText="Kirim ke Grup" cancelText="Cek Lagi" loading={sendingReport} onCancel={closeReportConfirm} onConfirm={sendResidentReport}>
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
