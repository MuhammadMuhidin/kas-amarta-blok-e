import { useEffect, useMemo, useState } from "react";
import MonitoringCard from "@/components/admin/MonitoringCard";
import TelegramIntegrationHealthCard from "@/components/admin/TelegramIntegrationHealthCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { formatJakartaDateTimeLong } from "@/lib/localDate";

function IssueTable({ title, rows, columns }) {
  if (!rows?.length) return null;
  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead><tr>{columns.map((column) => <th key={column} className="admin-th">{column === "detail" ? "Issue" : column}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={index} className={index % 2 ? "admin-row-alt admin-clickable-row" : "admin-clickable-row"}>
              {columns.map((column) => <td key={column} className="admin-td admin-issue-text">{row[column]}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function RepairIssueTable({ title, rows, repairingPaymentId, onRepair, repairType }) {
  if (!rows?.length) return null;
  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead><tr><th className="admin-th">house</th><th className="admin-th">name</th><th className="admin-th">period</th><th className="admin-th">Issue</th><th className="admin-th">Action</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const canRepair = row.type === repairType && row.payment_id;
            const repairing = repairingPaymentId === row.payment_id;
            const rowClassName = [index % 2 ? "admin-row-alt" : "", "admin-clickable-row", repairing ? "monitoring-row-repairing" : ""].filter(Boolean).join(" ");
            return (
              <tr key={`${row.type}-${row.payment_id || row.house}-${row.period}-${index}`} className={rowClassName}>
                <td className="admin-td admin-issue-text">{row.house}</td>
                <td className="admin-td admin-issue-text">{row.name}</td>
                <td className="admin-td admin-issue-text">{row.period}</td>
                <td className="admin-td admin-issue-text">{row.detail}</td>
                <td className="admin-td admin-issue-text">
                  {canRepair ? (
                    <button type="button" className="admin-small-btn monitoring-repair-btn" disabled={repairing || Boolean(repairingPaymentId)} onClick={() => onRepair(row)}>
                      {repairing ? "Repairing..." : "Repair"}
                    </button>
                  ) : <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Manual review</span>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="admin-monitor-section" style={{ marginBottom: 20 }}><h2 style={{ margin: "0 0 12px" }}>{title}</h2>{children}</div>;
}

const rupiah = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
const n = (value) => Number.isFinite(Number(value || 0)) ? Number(value || 0) : 0;
const normalize = (value) => String(value || "").trim();
const keyOf = (personId, period) => `${normalize(personId)}|${normalize(period)}`;

function parseTrashAdvanceRefId(refId) {
  const parts = normalize(refId).split("-");
  if (parts.length < 4 || parts[0].toUpperCase() !== "TRASHADV") return null;
  const period = `${parts.at(-2)}-${parts.at(-1)}`;
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const personId = parts.slice(1, -2).join("-");
  return personId ? { personId, period } : null;
}

function parseTrashReimbursementRefId(refId) {
  const normalized = normalize(refId);
  const prefix = "TRASHREIMB-";
  if (!normalized.toUpperCase().startsWith(prefix)) return null;
  const paymentId = normalized.slice(prefix.length);
  return paymentId ? { paymentId } : null;
}

function getSettlement({ cashflows, deposits, trashRecords, payments }) {
  const periodNow = getCurrentPeriod();
  const recon = deposits.filter((deposit) => String(deposit.status || "").toLowerCase() !== "paid").reduce((total, deposit) => total + n(deposit.amount) + n(deposit.trash_amount), 0);
  const paymentById = new Map(payments.map((payment) => [normalize(payment.id), payment]));
  const trashPayments = trashRecords.map((trash) => ({ trash, payment: paymentById.get(normalize(trash.payment_id)) })).filter(({ payment }) => payment && normalize(payment.period) === periodNow);
  const trashPaymentKeys = new Set(trashPayments.map(({ payment }) => keyOf(payment.person_id, payment.period)));
  const advanceRecords = cashflows.map((cashflow) => { const parsed = parseTrashAdvanceRefId(cashflow.ref_id); return parsed ? { cashflow, ...parsed } : null; }).filter((item) => item && normalize(item.cashflow.type).toLowerCase() === "expense" && item.period === periodNow);
  const reimbursementRecords = cashflows.map((cashflow) => { const parsed = parseTrashReimbursementRefId(cashflow.ref_id); const payment = parsed ? paymentById.get(normalize(parsed.paymentId)) : null; return payment ? { cashflow, payment } : null; }).filter((item) => item && normalize(item.cashflow.type).toLowerCase() === "income" && normalize(item.payment.period) === periodNow);
  const advanceKeys = new Set(advanceRecords.map((item) => keyOf(item.personId, item.period)));
  return {
    recon,
    trashMonthlyReceived: trashPayments.reduce((total, { trash }) => total + n(trash.amount), 0),
    trashAdvanceOutstanding: advanceRecords.reduce((total, item) => trashPaymentKeys.has(keyOf(item.personId, item.period)) ? total : total + n(item.cashflow.amount), 0),
    trashReimbursed: reimbursementRecords.reduce((total, item) => total + n(item.cashflow.amount), 0),
    trashPaidDirect: trashPayments.reduce((total, { trash, payment }) => advanceKeys.has(keyOf(payment.person_id, payment.period)) ? total : total + n(trash.amount), 0),
  };
}

function fmtTime(value) {
  if (!value || value === "unknown") return value || "unknown";
  return `${formatJakartaDateTimeLong(value, "id-ID")} WIB`;
}

function BuildBadge({ loading, buildInfo }) {
  const ok = Boolean(buildInfo);
  const text = loading ? "Checking build..." : ok ? `${String(buildInfo.platform || "UNKNOWN").toUpperCase()} - ${buildInfo.branch}` : "Build info not found";
  const title = ok ? `Commit: ${buildInfo.commitShort}\nMessage: ${buildInfo.commitMessage || "unknown"}\nEnv: ${buildInfo.environment}\nBuilt: ${fmtTime(buildInfo.buildTime)}` : "";
  const dotClassName = loading ? "monitoring-build-dot monitoring-build-dot-loading" : ok ? "monitoring-build-dot monitoring-build-dot-ok" : "monitoring-build-dot monitoring-build-dot-error";
  return <div className="monitoring-build-badge" title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--admin-border)", background: "var(--admin-row)", color: "var(--admin-muted)", fontSize: 12, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", position: "static", alignSelf: "flex-start", flexShrink: 0 }}><span className={dotClassName}/><span>{text}</span></div>;
}

function PhoneNumberModal({ open, value, loading, onChange, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel()} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 18, background: "rgba(15,23,42,.58)" }}>
      <form onSubmit={(event) => { event.preventDefault(); onConfirm(); }} style={{ width: "min(100%,430px)", borderRadius: 18, border: "1px solid var(--admin-border)", background: "var(--admin-card)", padding: 20, boxShadow: "0 22px 60px rgba(15,23,42,.3)", display: "grid", gap: 14 }}>
        <div><h3 style={{ margin: "0 0 6px" }}>Konfirmasi Nomor WhatsApp</h3><div style={{ color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.55 }}>Nomor hanya digunakan sementara untuk membuat pairing code ketika session Baileys keluar. Nomor tidak disimpan oleh aplikasi.</div></div>
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800 }}>Nomor WhatsApp<input autoFocus inputMode="tel" autoComplete="tel" placeholder="Contoh: 628123456789" value={value} onChange={(event) => onChange(event.target.value)} disabled={loading} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--admin-border)", borderRadius: 12, padding: "12px 13px", background: "var(--admin-row)", color: "var(--admin-text)", fontSize: 15 }} /></label>
        <div style={{ color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.45 }}>Boleh diawali 08, +62, atau 62. Sistem akan menormalkan nomor sebelum dikirim ke Baileys.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><button type="button" className="admin-small-btn" disabled={loading} onClick={onCancel}>Batal</button><button type="submit" className="admin-small-btn admin-refresh-btn" disabled={loading || !value.trim()}>{loading ? "Memulai..." : "Mulai Test"}</button></div>
      </form>
    </div>
  );
}

function WhatsAppInlineStatus({ events }) {
  if (!events.length) return null;
  const latest = events.at(-1) || {};
  const pairingCode = [...events].reverse().find((event) => event.status === "PAIRING_CODE")?.code || "";
  const terminalError = latest.status === "FAILED";
  const terminalSuccess = latest.status === "SENT";
  const color = terminalError ? "#dc2626" : terminalSuccess ? "#16a34a" : pairingCode ? "#d97706" : "#2563eb";
  return (
    <div style={{ border: `1px solid ${color}45`, background: `${color}0d`, borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong style={{ color }}>WhatsApp: {latest.status || "PROCESSING"}</strong>{latest.sessionId && <span style={{ color: "var(--admin-muted)", fontSize: 12, fontWeight: 800 }}>Session: {latest.sessionId}</span>}</div>
      {pairingCode && (
        <div style={{ border: "1px dashed #d97706", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#d97706" }}>PAIRING CODE</div>
          <div style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>{pairingCode}</div>
          <div style={{ color: "var(--admin-muted)", fontSize: 12, lineHeight: 1.5 }}>Buka WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon, lalu masukkan kode ini.</div>
          <button type="button" className="admin-small-btn" style={{ justifySelf: "start" }} onClick={() => navigator.clipboard?.writeText(pairingCode)}>Salin Kode</button>
        </div>
      )}
      <div style={{ display: "grid", gap: 5 }}>{events.slice(-8).map((event, index) => <div key={`${event.status}-${event.receivedAt || event.timestamp}-${index}`} style={{ color: event.status === "FAILED" ? "#dc2626" : "var(--admin-muted)", fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}><span style={{ color: "var(--admin-text)" }}>{event.status}</span>{event.message ? ` — ${event.message}` : ""}</div>)}</div>
    </div>
  );
}

function AlertTestCard({ testingWhatsApp, testingEmail, whatsappEvents, emailResult, onOpenWhatsApp, onTestEmail }) {
  const emailColor = emailResult?.type === "error" ? "#dc2626" : emailResult?.type === "success" ? "#16a34a" : "var(--admin-muted)";
  return (
    <div className={testingWhatsApp || testingEmail ? "monitoring-alert-test-card monitoring-alert-test-card-loading" : "monitoring-alert-test-card"} style={{ marginBottom: 20, padding: 16, borderRadius: 16, border: "1px solid var(--admin-border)", background: "var(--admin-row)", display: "grid", gap: 12 }}>
      <div><h3 style={{ margin: "0 0 4px" }}>Alert Channel Test</h3><div style={{ fontSize: 13, color: "var(--admin-muted)", fontWeight: 600, lineHeight: 1.5 }}>Uji WhatsApp dan email secara terpisah. Status pairing WhatsApp akan tampil langsung di bawah ini.</div></div>
      <WhatsAppInlineStatus events={whatsappEvents}/>
      {emailResult?.message && <div style={{ border: `1px solid ${emailColor}45`, background: `${emailColor}0d`, borderRadius: 12, padding: 12, color: emailColor, fontSize: 12, fontWeight: 800, lineHeight: 1.5 }}>{emailResult.message}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <button type="button" className="admin-small-btn admin-refresh-btn" disabled={testingWhatsApp} onClick={onOpenWhatsApp}>{testingWhatsApp ? "Testing WhatsApp..." : "Test WhatsApp"}</button>
        <button type="button" className="admin-small-btn admin-refresh-btn" disabled={testingEmail} onClick={onTestEmail}>{testingEmail ? "Testing Email..." : "Test Email"}</button>
      </div>
      <TelegramIntegrationHealthCard />
    </div>
  );
}

function DatabaseStatusCard({ loading, connected, rows }) {
  const items = [{ label: "Personal", value: rows.personal.length }, { label: "Payment", value: rows.payments.length }, { label: "Cashflow", value: rows.cashflows.length }, { label: "Trash", value: rows.trashRecords.length }, { label: "Deposit", value: rows.deposits.length }];
  const totalRows = items.reduce((sum, item) => sum + item.value, 0);
  const statusText = loading ? "Checking..." : connected ? "Connected" : "Need check";
  const statusColor = loading ? "#64748b" : connected ? "#16a34a" : "#dc2626";
  return <div className="admin-status-card" style={{ display: "grid", gap: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}><div><div className="admin-status-label">Database API</div><div className={connected ? "admin-status-value" : "admin-status-error"} style={{ fontSize: 30, lineHeight: 1.1, marginTop: 4 }}>{loading ? "..." : totalRows.toLocaleString("id-ID")}</div><div className="admin-status-meta">total rows loaded from Supabase</div></div><div style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${statusColor}33`, background: `${statusColor}12`, color: statusColor, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor, display: "inline-block" }}/>{statusText}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 8 }}>{items.map((item) => <div key={item.label} style={{ border: "1px solid var(--admin-border)", background: "var(--admin-row)", borderRadius: 12, padding: "10px 11px" }}><div className="admin-status-label" style={{ fontSize: 11 }}>{item.label}</div><div className="admin-status-value" style={{ fontSize: 21, lineHeight: 1.15, marginTop: 4 }}>{loading ? "-" : item.value.toLocaleString("id-ID")}</div><div className="admin-status-meta">rows</div></div>)}</div></div>;
}

function getHealthStatus({ loadingSettlement, rows, buildInfo, paymentCashflowIntegrity, trashMismatch, trashAdvanceReimbursementIntegrity, depositPaymentIntegrity, suspiciousData }) {
  const databaseOk = !loadingSettlement && (rows.personal.length + rows.cashflows.length + rows.deposits.length + rows.payments.length + rows.trashRecords.length) > 0;
  const buildOk = Boolean(buildInfo);
  const integrityIssueCount = paymentCashflowIntegrity.length + trashMismatch.length + trashAdvanceReimbursementIntegrity.length + depositPaymentIntegrity.length + suspiciousData.length;
  return { databaseOk, buildOk, integrityOk: integrityIssueCount === 0, reportReady: databaseOk && buildOk, integrityIssueCount };
}

function getReceiptStorageView(loading, data) {
  if (loading) return { value: "Checking...", meta: ["Checking public access to R2 receipts."], error: false };
  if (!data) return { value: "Need check", meta: ["Receipt health check is not available yet."], error: true };
  if (data.status === "no_sample") return { value: "No receipt sample", meta: [data.message || "No receipt_url sample is available for automatic checking yet."], error: false };
  if (data.ok) return { value: "Reachable", meta: [data.host ? `Host: ${data.host}` : "R2 public receipts are reachable.", data.status_code ? `HTTP ${data.status_code}` : data.message].filter(Boolean), error: false };
  return { value: "Unreachable", meta: [data.message || "R2 public receipts are not reachable.", data.status_code ? `HTTP ${data.status_code}` : "Residents may not be able to open receipts."], error: true };
}

export default function MonitoringTab({ paymentCashflowIntegrity, trashMismatch, trashAdvanceReimbursementIntegrity, depositPaymentIntegrity, suspiciousData, onRepairComplete }) {
  const [buildInfo, setBuildInfo] = useState(null);
  const [loadingBuildInfo, setLoadingBuildInfo] = useState(false);
  const [loadingSettlement, setLoadingSettlement] = useState(false);
  const [loadingReceiptStorage, setLoadingReceiptStorage] = useState(false);
  const [receiptStorage, setReceiptStorage] = useState(null);
  const [repairingPaymentId, setRepairingPaymentId] = useState("");
  const [repairingReimbursementPaymentId, setRepairingReimbursementPaymentId] = useState("");
  const [repairedPaymentIds, setRepairedPaymentIds] = useState([]);
  const [repairedReimbursementPaymentIds, setRepairedReimbursementPaymentIds] = useState([]);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappJobId, setWhatsAppJobId] = useState("");
  const [whatsappEvents, setWhatsAppEvents] = useState([]);
  const [emailResult, setEmailResult] = useState(null);
  const [rows, setRows] = useState({ personal: [], cashflows: [], deposits: [], payments: [], trashRecords: [] });

  const displayedTrashMismatch = useMemo(() => trashMismatch.filter((row) => !repairedPaymentIds.includes(row.payment_id)), [trashMismatch, repairedPaymentIds]);
  const displayedReimbursementIssues = useMemo(() => trashAdvanceReimbursementIntegrity.filter((row) => !repairedReimbursementPaymentIds.includes(row.payment_id)), [trashAdvanceReimbursementIntegrity, repairedReimbursementPaymentIds]);
  const settlement = useMemo(() => getSettlement(rows), [rows]);
  const health = useMemo(() => getHealthStatus({ loadingSettlement, rows, buildInfo, paymentCashflowIntegrity, trashMismatch: displayedTrashMismatch, trashAdvanceReimbursementIntegrity: displayedReimbursementIssues, depositPaymentIntegrity, suspiciousData }), [loadingSettlement, rows, buildInfo, paymentCashflowIntegrity, displayedTrashMismatch, displayedReimbursementIssues, depositPaymentIntegrity, suspiciousData]);
  const receiptStorageView = useMemo(() => getReceiptStorageView(loadingReceiptStorage, receiptStorage), [loadingReceiptStorage, receiptStorage]);

  async function handleRepairTrash(row) {
    if (!row?.payment_id || repairingPaymentId) return;
    setRepairingPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/repair", "POST", { payment_id: row.payment_id });
      setRepairedPaymentIds((previous) => previous.includes(row.payment_id) ? previous : [...previous, row.payment_id]);
      await onRepairComplete?.();
    } finally { setRepairingPaymentId(""); }
  }

  async function handleRepairReimbursement(row) {
    if (!row?.payment_id || repairingReimbursementPaymentId) return;
    setRepairingReimbursementPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/reimbursement-repair", "POST", { payment_id: row.payment_id });
      setRepairedReimbursementPaymentIds((previous) => previous.includes(row.payment_id) ? previous : [...previous, row.payment_id]);
      await onRepairComplete?.();
    } finally { setRepairingReimbursementPaymentId(""); }
  }

  async function handleStartWhatsAppTest() {
    if (testingWhatsApp) return;
    setTestingWhatsApp(true);
    setWhatsAppEvents([]);
    try {
      const data = await sendJson("/api/waha/test/start", "POST", { phoneNumber, period: getCurrentPeriod() });
      setWhatsAppJobId(data.jobId);
      setPhoneModalOpen(false);
      setPhoneNumber("");
    } catch (error) {
      setWhatsAppEvents([{ status: "FAILED", message: error.message || "Gagal memulai test WhatsApp", receivedAt: new Date().toISOString() }]);
      setTestingWhatsApp(false);
    }
  }

  async function handleTestEmail() {
    if (testingEmail) return;
    setTestingEmail(true);
    setEmailResult(null);
    try {
      const data = await sendJson("/api/waha/test/email", "POST", { period: getCurrentPeriod() });
      const email = data?.email || {};
      if (email.ok) setEmailResult({ type: "success", message: "Email test berhasil dikirim." });
      else if (email.skipped) setEmailResult({ type: "error", message: `Email test dilewati: ${email.reason || "konfigurasi tidak aktif"}.` });
      else setEmailResult({ type: "error", message: `Email test gagal: ${email.error || "unknown error"}.` });
    } catch (error) {
      setEmailResult({ type: "error", message: error.message || "Gagal mengirim email test" });
    } finally { setTestingEmail(false); }
  }

  useEffect(() => {
    if (!whatsappJobId) return undefined;
    let active = true;
    let timer;
    async function poll() {
      try {
        const response = await fetch(`/api/waha/test/status?jobId=${encodeURIComponent(whatsappJobId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Gagal membaca status WhatsApp");
        if (!active) return;
        const events = Array.isArray(data.events) ? data.events : [];
        setWhatsAppEvents(events);
        const latestStatus = events.at(-1)?.status;
        if (["SENT", "FAILED"].includes(latestStatus)) {
          setTestingWhatsApp(false);
          clearInterval(timer);
        }
      } catch (error) {
        if (!active) return;
        setWhatsAppEvents((previous) => [...previous, { status: "FAILED", message: error.message || "Gagal membaca status WhatsApp", receivedAt: new Date().toISOString() }]);
        setTestingWhatsApp(false);
        clearInterval(timer);
      }
    }
    poll();
    timer = setInterval(poll, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [whatsappJobId]);

  useEffect(() => {
    let active = true;
    async function loadSettlement() {
      setLoadingSettlement(true);
      try {
        const endpoints = ["personal", "payment", "cashflow", "trash", "deposit"];
        const responses = await Promise.all(endpoints.map((endpoint) => fetch(`/api/sheets/${endpoint}`, { cache: "no-store" })));
        const data = await Promise.all(responses.map((response) => response.json()));
        if (active) setRows({ personal: Array.isArray(data[0]) ? data[0] : [], payments: Array.isArray(data[1]) ? data[1] : [], cashflows: Array.isArray(data[2]) ? data[2] : [], trashRecords: Array.isArray(data[3]) ? data[3] : [], deposits: Array.isArray(data[4]) ? data[4] : [] });
      } catch {
        if (active) setRows({ personal: [], cashflows: [], deposits: [], payments: [], trashRecords: [] });
      } finally { if (active) setLoadingSettlement(false); }
    }
    loadSettlement();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBuildInfo() {
      setLoadingBuildInfo(true);
      try { const response = await fetch("/api/build-info", { cache: "no-store" }); const data = await response.json(); if (active) setBuildInfo(data?.build || null); }
      catch { if (active) setBuildInfo(null); }
      finally { if (active) setLoadingBuildInfo(false); }
    }
    loadBuildInfo();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadReceiptStorage() {
      setLoadingReceiptStorage(true);
      try { const response = await fetch("/api/health/receipt-storage", { cache: "no-store" }); const data = await response.json(); if (active) setReceiptStorage(data); }
      catch (error) { if (active) setReceiptStorage({ ok: false, status: "error", message: error.message || "Failed to check R2 public receipts." }); }
      finally { if (active) setLoadingReceiptStorage(false); }
    }
    loadReceiptStorage();
    return () => { active = false; };
  }, []);

  return (
    <div className="admin-card">
      <PhoneNumberModal open={phoneModalOpen} value={phoneNumber} loading={testingWhatsApp} onChange={setPhoneNumber} onCancel={() => setPhoneModalOpen(false)} onConfirm={handleStartWhatsAppTest}/>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 18, flexWrap: "wrap", position: "static" }}><div><h2 style={{ margin: "0 0 4px" }}>Monitoring</h2><div style={{ fontSize: 13, color: "var(--admin-muted)", fontWeight: 600 }}>Settlement, system status, and data quality.</div></div><BuildBadge loading={loadingBuildInfo} buildInfo={buildInfo}/></div>
      <AlertTestCard testingWhatsApp={testingWhatsApp} testingEmail={testingEmail} whatsappEvents={whatsappEvents} emailResult={emailResult} onOpenWhatsApp={() => { setPhoneNumber(""); setPhoneModalOpen(true); }} onTestEmail={handleTestEmail}/>
      <Section title="Operational Health Check"><div className="admin-monitor-grid"><DatabaseStatusCard loading={loadingSettlement} connected={health.databaseOk} rows={rows}/><MonitoringCard label="Integrity Health" value={health.integrityOk ? "Clean" : `${health.integrityIssueCount} issue`} meta={[health.integrityOk ? "No integrity issue detected." : "There are issues that need review."]} error={!health.integrityOk}/><MonitoringCard label="Report Readiness" value={health.reportReady ? "Ready" : "At risk"} meta={[health.reportReady ? "Data and build metadata are available for reports." : "Reports may fail if data/build status is unhealthy."]} error={!health.reportReady}/><MonitoringCard label="Receipt Storage" value={receiptStorageView.value} meta={receiptStorageView.meta} error={receiptStorageView.error}/></div></Section>
      <Section title="Settlement"><div className="admin-monitor-grid"><MonitoringCard label="Reconciliation Balance" value={loadingSettlement ? "Checking..." : rupiah(settlement.recon)} meta={["Total unpaid booking payments."]}/><MonitoringCard label="Monthly Trash Received" value={loadingSettlement ? "Checking..." : rupiah(settlement.trashMonthlyReceived)} meta={["Trash fee payments received for the current period."]}/><MonitoringCard label="Trash Advance Outstanding" value={loadingSettlement ? "Checking..." : rupiah(settlement.trashAdvanceOutstanding)} meta={["Advanced trash fees not reimbursed by residents yet."]} error={!loadingSettlement && settlement.trashAdvanceOutstanding > 0}/><MonitoringCard label="Trash Reimbursed" value={loadingSettlement ? "Checking..." : rupiah(settlement.trashReimbursed)} meta={["Recorded reimbursement income from trash advance."]}/><MonitoringCard label="Trash Paid Direct" value={loadingSettlement ? "Checking..." : rupiah(settlement.trashPaidDirect)} meta={["Trash fees paid without prior cash advance."]}/></div></Section>
      <Section title="System Status"><div className="admin-monitor-grid"><MonitoringCard label="Current Build" value={loadingBuildInfo ? "Checking..." : buildInfo ? `${String(buildInfo.platform || "UNKNOWN").toUpperCase()} - ${buildInfo.branch}` : "Build info not found"} meta={buildInfo ? [`Commit: ${buildInfo.commitShort}`, `Message: ${buildInfo.commitMessage || "unknown"}`, `Env: ${buildInfo.environment}`, `Built: ${fmtTime(buildInfo.buildTime)}`] : []} error={!loadingBuildInfo && !buildInfo}/></div></Section>
      <Section title="Integrity & Data Quality"><div className="admin-monitor-grid"><MonitoringCard label="Payment ⇄ Cashflow Integrity" value={`${paymentCashflowIntegrity.length} issue`} meta={[paymentCashflowIntegrity.length === 0 ? "No issue detected" : "Need review"]}/><MonitoringCard label="Payment ⇄ Deposit Integrity" value={`${depositPaymentIntegrity.length} issue`} meta={[depositPaymentIntegrity.length === 0 ? "No issue detected" : "Need review"]}/><MonitoringCard label="Payment ⇄ Trash Integrity" value={`${displayedTrashMismatch.length} issue`} meta={[displayedTrashMismatch.length === 0 ? "No issue detected" : "Need review"]}/><MonitoringCard label="Trash Advance ⇄ Reimbursement Integrity" value={`${displayedReimbursementIssues.length} issue`} meta={[displayedReimbursementIssues.length === 0 ? "No issue detected" : "Need review"]}/><MonitoringCard label="Data Quality Check" value={`${suspiciousData.length} issue`} meta={[suspiciousData.length === 0 ? "No suspicious data" : "Need review"]}/></div></Section>
      <IssueTable title="Payment ⇄ Cashflow Integrity" rows={paymentCashflowIntegrity} columns={["house", "name", "period", "type", "detail"]}/>
      <IssueTable title="Payment ⇄ Deposit Integrity" rows={depositPaymentIntegrity} columns={["house", "name", "period", "type", "detail"]}/>
      <RepairIssueTable title="Payment ⇄ Trash Integrity" rows={displayedTrashMismatch} repairingPaymentId={repairingPaymentId} onRepair={handleRepairTrash} repairType="PAYMENT_WITHOUT_TRASH"/>
      <RepairIssueTable title="Trash Advance ⇄ Reimbursement Integrity" rows={displayedReimbursementIssues} repairingPaymentId={repairingReimbursementPaymentId} onRepair={handleRepairReimbursement} repairType="MISSING_REIMBURSEMENT"/>
      <IssueTable title="Suspicious Data" rows={suspiciousData} columns={["sheet", "row", "type", "detail"]}/>
    </div>
  );
}
