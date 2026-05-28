"use client";

import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { useState } from "react";

const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function normalize(value) {
  return String(value || "").trim();
}

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

export default function OverviewTab({
  personal,
  payments,
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
  const [reportStatus, setReportStatus] = useState(null);

  async function openResidentReportConfirm() {
    if (loadingReportPreview || sendingReport) return;

    setLoadingReportPreview(true);
    setReportStatus(null);

    try {
      const data = await sendJson("/api/waha/monthly-summary", "POST", { preview: true });
      setReportPreview(data.text || "");
      setShowReportConfirm(true);
    } catch (err) {
      setReportStatus({ type: "error", text: err.message || "Gagal memuat preview rekap." });
    } finally {
      setLoadingReportPreview(false);
    }
  }

  async function sendResidentReport() {
    if (sendingReport) return;

    setSendingReport(true);
    setReportStatus(null);

    try {
      await sendJson("/api/waha/monthly-summary", "POST", {});
      setShowReportConfirm(false);
      setReportPreview("");
      setReportStatus({ type: "success", text: "Rekap berhasil dikirim ke grup WhatsApp." });
    } catch (err) {
      setReportStatus({ type: "error", text: err.message || "Gagal mengirim rekap ke grup." });
    } finally {
      setSendingReport(false);
    }
  }

  function closeReportConfirm() {
    if (sendingReport) return;

    setShowReportConfirm(false);
  }

  const activeMembers = personal.filter((person) => person.active === "Y");
  const activeCurrentMembers = activeMembers.filter((person) => {
    if (!person.join_date) return true;
    return String(person.join_date).slice(0, 7) <= currentPeriod;
  });

  const paidCurrentKeys = new Set(
    payments
      .filter((payment) => String(payment.period || "").slice(0, 7) === currentPeriod)
      .map((payment) => normalize(payment.person_house || payment.house || payment.person_id)),
  );

  const paidCurrentCount = activeCurrentMembers.filter((person) =>
    paidCurrentKeys.has(normalize(person.house)),
  ).length;
  const unpaidCurrentCount = Math.max(activeCurrentMembers.length - paidCurrentCount, 0);

  const currentMonthCashflows = cashflows.filter(
    (item) => String(item.date || "").slice(0, 7) === currentPeriod,
  );
  const currentIncome = currentMonthCashflows
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentExpense = currentMonthCashflows
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allIncome = cashflows
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allExpense = cashflows
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentBalance = allIncome - allExpense;

  const readyBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "pending");
  const waitingBookings = sortedDeposits.filter((deposit) => getDepositStatus(deposit) === "waiting");
  const backupOk = Boolean(dailyBackup?.ok);
  const configOk = Boolean(appConfig);

  const recentCashflows = [...cashflows]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 5);

  const alerts = [
    unpaidCurrentCount > 0 && {
      tone: "warning",
      title: `${unpaidCurrentCount} rumah belum bayar bulan ini`,
      detail: `Periode ${formatPeriod(currentPeriod)} masih perlu ditagih atau dicek.`,
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
      <div className="admin-card" style={{ display: "grid", gap: 22 }}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Overview</h2>
            <div style={styles.muted}>Ringkasan operasional kas, pembayaran, booking, dan kesehatan sistem.</div>
          </div>
          <div style={styles.periodBadge}>{formatPeriod(currentPeriod)}</div>
        </div>

        <Section title="Quick Summary">
          <div className="admin-monitor-grid">
            <MonitoringCard label="Saldo Kas" value={money(currentBalance)} meta={["Income dikurangi expense semua periode."]} error={currentBalance < 0} />
            <MonitoringCard label="Pemasukan Bulan Ini" value={money(currentIncome)} meta={[`Periode ${formatPeriod(currentPeriod)}`]} />
            <MonitoringCard label="Pengeluaran Bulan Ini" value={money(currentExpense)} meta={[`Periode ${formatPeriod(currentPeriod)}`]} />
            <MonitoringCard label="Pembayaran Bulan Ini" value={`${paidCurrentCount}/${activeCurrentMembers.length} rumah`} meta={[`${unpaidCurrentCount} rumah belum bayar.`]} error={unpaidCurrentCount > 0} />
            <MonitoringCard label="Ready Booking" value={`${readyBookings.length} rumah`} meta={[`${waitingBookings.length} booking menunggu periode bayar.`]} error={readyBookings.length > 0} />
            <MonitoringCard label="Monitoring Issue" value={`${monitoringIssueCount} issue`} meta={[monitoringIssueCount ? "Need review" : "No issue detected"]} error={monitoringIssueCount > 0} />
          </div>
        </Section>

        <Section title="Laporan Warga">
          <div style={styles.reportCard}>
            <div>
              <div style={styles.reportTitle}>Kirim rekap kas ke grup WhatsApp</div>
              <div style={styles.reportDetail}>Review isi pesan terlebih dulu sebelum dikirim ke grup warga.</div>
              {reportStatus && (
                <div style={{ ...styles.reportStatus, color: reportStatus.type === "success" ? "#16a34a" : "#dc2626" }}>
                  {reportStatus.text}
                </div>
              )}
            </div>
            <AdminActionButton
              onClick={openResidentReportConfirm}
              loading={loadingReportPreview}
              loadingText="Memuat preview..."
              disabled={sendingReport}
            >
              Kirim Rekap ke Grup WhatsApp
            </AdminActionButton>
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
                <AlertItem
                  key={alert.title}
                  tone={alert.tone}
                  title={alert.title}
                  detail={alert.detail}
                  action={alert.action}
                  onClick={() => onNavigate(alert.tab)}
                />
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

      <AdminConfirmModal
        open={showReportConfirm}
        title="Konfirmasi kirim rekap warga"
        description="Pastikan isi pesan sudah benar sebelum dikirim ke grup WhatsApp."
        confirmText="Kirim ke Grup"
        cancelText="Cek Lagi"
        loading={sendingReport}
        onCancel={closeReportConfirm}
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
  muted: {
    color: "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.6,
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
  quickActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  reportCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    flexWrap: "wrap",
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 4,
  },
  reportDetail: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  reportStatus: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 800,
  },
  previewBox: {
    margin: 0,
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    color: "var(--admin-text)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  alertList: {
    display: "grid",
    gap: 10,
  },
  alertItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 4,
  },
  alertDetail: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.5,
  },
};
