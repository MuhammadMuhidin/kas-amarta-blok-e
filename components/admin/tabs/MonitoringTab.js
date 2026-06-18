"use client";

import AdminSubtabs from "@/components/admin/AdminSubtabs";
import MonitoringCard from "@/components/admin/MonitoringCard";
import TelegramIntegrationHealthCard from "@/components/admin/TelegramIntegrationHealthCard";
import { getCookieValue, readJson, sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";
import { formatJakartaDateTimeLong } from "@/lib/localDate";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 25;
const EMPTY_ARRAY = [];

const rupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(Number(value || 0));
const n = (value) => Number.isFinite(Number(value || 0)) ? Number(value || 0) : 0;
const normalize = (value) => String(value || "").trim();
const keyOf = (personId, period) => `${normalize(personId)}|${normalize(period)}`;

function fmtTime(value) {
  if (!value || value === "unknown") return value || "unknown";
  return `${formatJakartaDateTimeLong(value, "id-ID")} WIB`;
}

function parseTrashAdvanceRefId(refId) {
  const parts = normalize(refId).split("-");
  if (parts.length < 4 || parts[0].toUpperCase() !== "TRASHADV") return null;
  const period = `${parts.at(-2)}-${parts.at(-1)}`;
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const personId = parts.slice(1, -2).join("-");
  return personId ? { personId, period } : null;
}

function parseTrashReimbursementRefId(refId) {
  const value = normalize(refId);
  const prefix = "TRASHREIMB-";
  if (!value.toUpperCase().startsWith(prefix)) return null;
  const paymentId = value.slice(prefix.length);
  return paymentId ? { paymentId } : null;
}

function getSettlement({ cashflows, deposits, trashRecords, payments }) {
  const periodNow = getCurrentPeriod();
  const recon = deposits
    .filter((deposit) => String(deposit.status || "").toLowerCase() !== "paid")
    .reduce((total, deposit) => total + n(deposit.amount) + n(deposit.trash_amount), 0);
  const paymentById = new Map(payments.map((payment) => [normalize(payment.id), payment]));
  const trashPayments = trashRecords
    .map((trash) => ({ trash, payment: paymentById.get(normalize(trash.payment_id)) }))
    .filter(({ payment }) => payment && normalize(payment.period) === periodNow);
  const trashPaymentKeys = new Set(
    trashPayments.map(({ payment }) => keyOf(payment.person_id, payment.period)),
  );
  const advanceRecords = cashflows
    .map((cashflow) => {
      const parsed = parseTrashAdvanceRefId(cashflow.ref_id);
      return parsed ? { cashflow, ...parsed } : null;
    })
    .filter((item) => item
      && normalize(item.cashflow.type).toLowerCase() === "expense"
      && item.period === periodNow);
  const reimbursementRecords = cashflows
    .map((cashflow) => {
      const parsed = parseTrashReimbursementRefId(cashflow.ref_id);
      const payment = parsed ? paymentById.get(normalize(parsed.paymentId)) : null;
      return payment ? { cashflow, payment } : null;
    })
    .filter((item) => item
      && normalize(item.cashflow.type).toLowerCase() === "income"
      && normalize(item.payment.period) === periodNow);
  const advanceKeys = new Set(
    advanceRecords.map((item) => keyOf(item.personId, item.period)),
  );

  return {
    recon,
    trashMonthlyReceived: trashPayments.reduce(
      (total, { trash }) => total + n(trash.amount),
      0,
    ),
    trashAdvanceOutstanding: advanceRecords.reduce(
      (total, item) => trashPaymentKeys.has(keyOf(item.personId, item.period))
        ? total
        : total + n(item.cashflow.amount),
      0,
    ),
    trashReimbursed: reimbursementRecords.reduce(
      (total, item) => total + n(item.cashflow.amount),
      0,
    ),
    trashPaidDirect: trashPayments.reduce(
      (total, { trash, payment }) => advanceKeys.has(keyOf(payment.person_id, payment.period))
        ? total
        : total + n(trash.amount),
      0,
    ),
  };
}

function Pagination({ page, totalPages, totalRows, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={styles.pagination}>
      <span style={styles.paginationMeta}>
        Page {page + 1} of {totalPages} · {totalRows.toLocaleString("id-ID")} rows
      </span>
      <div style={styles.paginationActions}>
        <button
          type="button"
          className="admin-small-btn"
          disabled={page <= 0}
          onClick={() => onChange(Math.max(0, page - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="admin-small-btn"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function IssueTable({ title, rows = EMPTY_ARRAY, columns }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rows, page],
  );

  useEffect(() => setPage(0), [rows]);
  if (!rows.length) return null;

  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="admin-th">
                  {column === "detail" ? "Issue" : column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={`${page}-${row.id || row.payment_id || row.house || row.row || index}`}
                className={index % 2 ? "admin-row-alt" : ""}
              >
                {columns.map((column) => (
                  <td key={column} className="admin-td admin-issue-text">
                    {row[column] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalRows={rows.length}
        onChange={setPage}
      />
    </div>
  );
}

function RepairIssueTable({ title, rows = EMPTY_ARRAY, runningId, onRepair, repairType }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rows, page],
  );

  useEffect(() => setPage(0), [rows]);
  if (!rows.length) return null;

  return (
    <div className="admin-monitor-detail">
      <h3>{title}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">House</th>
              <th className="admin-th">Name</th>
              <th className="admin-th">Period</th>
              <th className="admin-th">Issue</th>
              <th className="admin-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const canRepair = row.type === repairType && row.payment_id;
              const repairing = runningId === row.payment_id;
              return (
                <tr
                  key={`${row.type}-${row.payment_id || row.house}-${row.period}-${index}`}
                  className={index % 2 ? "admin-row-alt" : ""}
                >
                  <td className="admin-td">{row.house || "-"}</td>
                  <td className="admin-td">{row.name || "-"}</td>
                  <td className="admin-td">{row.period || "-"}</td>
                  <td className="admin-td admin-issue-text">{row.detail || "-"}</td>
                  <td className="admin-td">
                    {canRepair ? (
                      <button
                        type="button"
                        className="admin-small-btn"
                        disabled={repairing || Boolean(runningId)}
                        onClick={() => onRepair(row)}
                      >
                        {repairing ? "Repairing..." : "Repair"}
                      </button>
                    ) : (
                      <span style={styles.muted}>Manual review</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalRows={rows.length}
        onChange={setPage}
      />
    </div>
  );
}

function HealthPanel() {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buildInfo, setBuildInfo] = useState(null);
  const [receiptStorage, setReceiptStorage] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    Promise.allSettled([
      readJson("/api/build-info", { signal: controller.signal }),
      readJson("/api/health/receipt-storage", { signal: controller.signal }),
    ])
      .then(([buildResult, receiptResult]) => {
        if (controller.signal.aborted || requestRef.current !== controller) return;
        setBuildInfo(buildResult.status === "fulfilled" ? buildResult.value?.build || null : null);
        setReceiptStorage(
          receiptResult.status === "fulfilled"
            ? receiptResult.value
            : { ok: false, message: receiptResult.reason?.message || "Receipt health check failed" },
        );
        if (buildResult.status === "rejected" && receiptResult.status === "rejected") {
          setError("System health checks could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [version]);

  const receiptOk = receiptStorage?.ok || receiptStorage?.status === "no_sample";
  const receiptValue = loading
    ? "Checking..."
    : receiptStorage?.status === "no_sample"
      ? "No sample"
      : receiptStorage?.ok
        ? "Reachable"
        : "Unreachable";

  return (
    <div id="monitoring-overview-panel" role="tabpanel">
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.panelTitle}>Operational Overview</h3>
          <p style={styles.muted}>Lightweight build and storage checks.</p>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          Refresh
        </button>
      </div>
      {error && <div className="admin-error-box">{error}</div>}
      <div className="admin-monitor-grid">
        <MonitoringCard
          label="Current Build"
          value={loading
            ? "Checking..."
            : buildInfo
              ? `${String(buildInfo.platform || "UNKNOWN").toUpperCase()} - ${buildInfo.branch}`
              : "Build info unavailable"}
          meta={buildInfo
            ? [
                `Commit: ${buildInfo.commitShort}`,
                `Env: ${buildInfo.environment}`,
                `Built: ${fmtTime(buildInfo.buildTime)}`,
              ]
            : []}
          error={!loading && !buildInfo}
        />
        <MonitoringCard
          label="Receipt Storage"
          value={receiptValue}
          meta={[receiptStorage?.message || "Checking public receipt access."]}
          error={!loading && !receiptOk}
        />
      </div>
    </div>
  );
}

function PhoneNumberModal({ open, value, loading, onChange, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      style={styles.modalOverlay}
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel()}
    >
      <form
        style={styles.modalBox}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 6px" }}>Confirm WhatsApp Number</h3>
          <div style={styles.muted}>
            The number is used temporarily to generate a pairing code when the session is disconnected.
          </div>
        </div>
        <input
          className="admin-input"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Example: 628123456789"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading}
          autoFocus
        />
        <div style={styles.modalActions}>
          <button type="button" className="admin-small-btn" disabled={loading} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="admin-small-btn admin-refresh-btn" disabled={loading || !value.trim()}>
            {loading ? "Starting..." : "Start Test"}
          </button>
        </div>
      </form>
    </div>
  );
}

function parseSseBlock(block, sessionId) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("data:"))
    .map((line) => line.trim().slice(5).trim())
    .join("\n");
  const payload = data || block.trim();
  if (!payload || payload.startsWith(":")) return null;
  try {
    const parsed = JSON.parse(payload);
    const source = parsed?.event && typeof parsed.event === "object" ? parsed.event : parsed;
    return {
      ...source,
      status: String(source?.status || source?.type || "INFO").trim().toUpperCase(),
      sessionId: source?.sessionId || source?.session_id || sessionId,
      code: source?.code || source?.pairingCode || source?.pairing_code || source?.data?.code || "",
      message: source?.message || source?.error || "",
      receivedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function readWhatsAppEventStream(response, onEvent) {
  if (!response.body) throw new Error("External API did not return a response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const sessionId = response.headers.get("x-wa-session-id") || "";
  let buffer = "";
  let count = 0;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const event = parseSseBlock(block, sessionId);
      if (event) {
        count += 1;
        onEvent(event);
      }
    }
    if (done) break;
  }

  const finalEvent = parseSseBlock(buffer, sessionId);
  if (finalEvent) {
    count += 1;
    onEvent(finalEvent);
  }
  return count;
}

function ServiceTestsPanel() {
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappEvents, setWhatsappEvents] = useState([]);
  const [emailResult, setEmailResult] = useState(null);

  async function startWhatsAppTest() {
    if (testingWhatsApp) return;
    setTestingWhatsApp(true);
    setWhatsappEvents([{
      status: "CONNECTING",
      message: "Connecting to the external WhatsApp API...",
      receivedAt: new Date().toISOString(),
    }]);

    try {
      const response = await fetch("/api/waha/test/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookieValue("csrf_token"),
        },
        body: JSON.stringify({ phoneNumber, period: getCurrentPeriod() }),
      });
      if (!response.ok) {
        const raw = await response.text();
        let message = raw;
        try {
          message = JSON.parse(raw)?.error || raw;
        } catch {
          // Keep the raw response.
        }
        throw new Error(message || "Failed to start WhatsApp test");
      }

      setPhoneModalOpen(false);
      setPhoneNumber("");
      const received = await readWhatsAppEventStream(response, (event) => {
        setWhatsappEvents((previous) => [...previous, event].slice(-30));
      });
      if (!received) throw new Error("The external API returned no WhatsApp events.");
    } catch (error) {
      setWhatsappEvents((previous) => [...previous, {
        status: "FAILED",
        message: error.message || "WhatsApp test failed",
        receivedAt: new Date().toISOString(),
      }].slice(-30));
    } finally {
      setTestingWhatsApp(false);
    }
  }

  async function testEmail() {
    if (testingEmail) return;
    setTestingEmail(true);
    setEmailResult(null);
    try {
      const data = await sendJson("/api/waha/test/email", "POST", {
        period: getCurrentPeriod(),
      });
      const email = data?.email || {};
      if (email.ok) setEmailResult({ ok: true, message: "The test email was sent successfully." });
      else if (email.skipped) setEmailResult({ ok: false, message: `Email test skipped: ${email.reason || "disabled"}.` });
      else setEmailResult({ ok: false, message: `Email test failed: ${email.error || "unknown error"}.` });
    } catch (error) {
      setEmailResult({ ok: false, message: error.message || "Failed to send the test email" });
    } finally {
      setTestingEmail(false);
    }
  }

  const pairingCode = [...whatsappEvents]
    .reverse()
    .find((event) => event.status === "PAIRING_CODE" && event.code)?.code || "";

  return (
    <div id="monitoring-services-panel" role="tabpanel">
      <PhoneNumberModal
        open={phoneModalOpen}
        value={phoneNumber}
        loading={testingWhatsApp}
        onChange={setPhoneNumber}
        onCancel={() => setPhoneModalOpen(false)}
        onConfirm={startWhatsAppTest}
      />
      <div className="admin-status-card" style={styles.serviceCard}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Alert Channel Tests</h3>
            <p style={styles.muted}>Only mounted while Service Tests is active.</p>
          </div>
          <div style={styles.serviceActions}>
            <button
              type="button"
              className="admin-small-btn admin-refresh-btn"
              disabled={testingWhatsApp}
              onClick={() => setPhoneModalOpen(true)}
            >
              {testingWhatsApp ? "Testing WhatsApp..." : "Test WhatsApp"}
            </button>
            <button
              type="button"
              className="admin-small-btn admin-refresh-btn"
              disabled={testingEmail}
              onClick={testEmail}
            >
              {testingEmail ? "Testing Email..." : "Test Email"}
            </button>
          </div>
        </div>

        {pairingCode && (
          <div style={styles.pairingBox}>
            <strong>Pairing Code: {pairingCode}</strong>
            <button
              type="button"
              className="admin-small-btn"
              onClick={() => navigator.clipboard?.writeText(pairingCode)}
            >
              Copy Code
            </button>
          </div>
        )}

        {whatsappEvents.length > 0 && (
          <div style={styles.eventList}>
            {whatsappEvents.slice(-8).map((event, index) => (
              <div key={`${event.status}-${event.receivedAt}-${index}`} style={styles.eventRow}>
                <strong>{event.status}</strong>
                <span>{event.message || event.sessionId || ""}</span>
              </div>
            ))}
          </div>
        )}

        {emailResult && (
          <div className={emailResult.ok ? "admin-success-box" : "admin-error-box"}>
            {emailResult.message}
          </div>
        )}

        <TelegramIntegrationHealthCard />
      </div>
    </div>
  );
}

export default function MonitoringTab({
  paymentCashflowIntegrity = EMPTY_ARRAY,
  trashMismatch = EMPTY_ARRAY,
  trashAdvanceReimbursementIntegrity = EMPTY_ARRAY,
  depositPaymentIntegrity = EMPTY_ARRAY,
  suspiciousData = EMPTY_ARRAY,
  personal = EMPTY_ARRAY,
  payments = EMPTY_ARRAY,
  trashRecords = EMPTY_ARRAY,
  cashflows = EMPTY_ARRAY,
  deposits = EMPTY_ARRAY,
  loading = false,
  error = "",
  onRefresh,
  onRepairComplete,
}) {
  const [activePanel, setActivePanel] = useState("overview");
  const [repairingPaymentId, setRepairingPaymentId] = useState("");
  const [repairingReimbursementPaymentId, setRepairingReimbursementPaymentId] = useState("");
  const [repairedPaymentIds, setRepairedPaymentIds] = useState([]);
  const [repairedReimbursementPaymentIds, setRepairedReimbursementPaymentIds] = useState([]);

  const displayedTrashMismatch = useMemo(
    () => trashMismatch.filter((row) => !repairedPaymentIds.includes(row.payment_id)),
    [trashMismatch, repairedPaymentIds],
  );
  const displayedReimbursementIssues = useMemo(
    () => trashAdvanceReimbursementIntegrity.filter(
      (row) => !repairedReimbursementPaymentIds.includes(row.payment_id),
    ),
    [trashAdvanceReimbursementIntegrity, repairedReimbursementPaymentIds],
  );
  const integrityIssueCount = useMemo(
    () => paymentCashflowIntegrity.length
      + displayedTrashMismatch.length
      + displayedReimbursementIssues.length
      + depositPaymentIntegrity.length
      + suspiciousData.length,
    [
      paymentCashflowIntegrity,
      displayedTrashMismatch,
      displayedReimbursementIssues,
      depositPaymentIntegrity,
      suspiciousData,
    ],
  );

  const overviewDataCount = useMemo(
    () => personal.length + payments.length + cashflows.length + trashRecords.length + deposits.length,
    [personal.length, payments.length, cashflows.length, trashRecords.length, deposits.length],
  );

  const settlementIssueCount = useMemo(
    () => {
      const s = getSettlement({ cashflows, deposits, trashRecords, payments });
      return (Number(s.recon) > 0 ? 1 : 0) + (Number(s.trashAdvanceOutstanding) > 0 ? 1 : 0);
    },
    [cashflows, deposits, trashRecords, payments],
  );
  const settlement = useMemo(
    () => activePanel === "settlement"
      ? getSettlement({ cashflows, deposits, trashRecords, payments })
      : null,
    [activePanel, cashflows, deposits, trashRecords, payments],
  );

  async function repairTrash(row) {
    if (!row?.payment_id || repairingPaymentId) return;
    setRepairingPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/repair", "POST", { payment_id: row.payment_id });
      setRepairedPaymentIds((previous) => [...new Set([...previous, row.payment_id])]);
      await onRepairComplete?.();
    } finally {
      setRepairingPaymentId("");
    }
  }

  async function repairReimbursement(row) {
    if (!row?.payment_id || repairingReimbursementPaymentId) return;
    setRepairingReimbursementPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/reimbursement-repair", "POST", {
        payment_id: row.payment_id,
      });
      setRepairedReimbursementPaymentIds((previous) => [
        ...new Set([...previous, row.payment_id]),
      ]);
      await onRepairComplete?.();
    } finally {
      setRepairingReimbursementPaymentId("");
    }
  }

  return (
    <div className="admin-card">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Monitoring</h2>
          <p style={styles.muted}>System health, data integrity, settlement, and channel tests.</p>
        </div>
        <button
          type="button"
          className="admin-small-btn admin-refresh-btn"
          disabled={loading}
          onClick={() => onRefresh?.()}
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      <AdminSubtabs
        value={activePanel}
        onChange={setActivePanel}
        ariaLabel="Monitoring navigation"
        items={[
          { value: "overview", label: "Overview", badge: overviewDataCount, panelId: "monitoring-overview-panel" },
          {
            value: "integrity",
            label: "Data Integrity",
            badge: integrityIssueCount,
            panelId: "monitoring-integrity-panel",
          },
          { value: "settlement", label: "Settlement", badge: settlementIssueCount, panelId: "monitoring-settlement-panel" },
          { value: "services", label: "Service Tests", panelId: "monitoring-services-panel" },
        ]}
      />

      {activePanel === "overview" && <HealthPanel />}

      {activePanel === "integrity" && (
        <div id="monitoring-integrity-panel" role="tabpanel">
          {loading && <div className="admin-empty-state">Refreshing integrity data...</div>}
          <div className="admin-monitor-grid" style={{ marginBottom: 18 }}>
            <MonitoringCard
              label="Payment ⇄ Cashflow"
              value={`${paymentCashflowIntegrity.length} issue`}
              meta={[paymentCashflowIntegrity.length ? "Need review" : "Clean"]}
              error={paymentCashflowIntegrity.length > 0}
            />
            <MonitoringCard
              label="Payment ⇄ Deposit"
              value={`${depositPaymentIntegrity.length} issue`}
              meta={[depositPaymentIntegrity.length ? "Need review" : "Clean"]}
              error={depositPaymentIntegrity.length > 0}
            />
            <MonitoringCard
              label="Payment ⇄ Trash"
              value={`${displayedTrashMismatch.length} issue`}
              meta={[displayedTrashMismatch.length ? "Need review" : "Clean"]}
              error={displayedTrashMismatch.length > 0}
            />
            <MonitoringCard
              label="Trash Reimbursement"
              value={`${displayedReimbursementIssues.length} issue`}
              meta={[displayedReimbursementIssues.length ? "Need review" : "Clean"]}
              error={displayedReimbursementIssues.length > 0}
            />
            <MonitoringCard
              label="Suspicious Data"
              value={`${suspiciousData.length} issue`}
              meta={[suspiciousData.length ? "Need review" : "Clean"]}
              error={suspiciousData.length > 0}
            />
          </div>

          <IssueTable
            title="Payment ⇄ Cashflow Integrity"
            rows={paymentCashflowIntegrity}
            columns={["house", "name", "period", "type", "detail"]}
          />
          <IssueTable
            title="Payment ⇄ Deposit Integrity"
            rows={depositPaymentIntegrity}
            columns={["house", "name", "period", "type", "detail"]}
          />
          <RepairIssueTable
            title="Payment ⇄ Trash Integrity"
            rows={displayedTrashMismatch}
            runningId={repairingPaymentId}
            onRepair={repairTrash}
            repairType="PAYMENT_WITHOUT_TRASH"
          />
          <RepairIssueTable
            title="Trash Advance ⇄ Reimbursement Integrity"
            rows={displayedReimbursementIssues}
            runningId={repairingReimbursementPaymentId}
            onRepair={repairReimbursement}
            repairType="MISSING_REIMBURSEMENT"
          />
          <IssueTable
            title="Suspicious Data"
            rows={suspiciousData}
            columns={["sheet", "row", "type", "detail"]}
          />
        </div>
      )}

      {activePanel === "settlement" && (
        <div id="monitoring-settlement-panel" role="tabpanel">
          {loading ? (
            <div className="admin-empty-state">Refreshing settlement data...</div>
          ) : error ? (
            <div className="admin-error-box">Settlement cannot be calculated until monitoring data loads successfully.</div>
          ) : (
            <>
              <div className="admin-monitor-grid">
                <MonitoringCard
                  label="Database Dataset"
                  value={`${personal.length + payments.length + cashflows.length + trashRecords.length + deposits.length} rows`}
                  meta={[
                    `Personal ${personal.length}`,
                    `Payment ${payments.length}`,
                    `Cashflow ${cashflows.length}`,
                    `Trash ${trashRecords.length}`,
                    `Deposit ${deposits.length}`,
                  ]}
                />
                <MonitoringCard
                  label="Reconciliation Balance"
                  value={rupiah(settlement?.recon)}
                  meta={["Total unpaid booking payments."]}
                />
                <MonitoringCard
                  label="Monthly Trash Received"
                  value={rupiah(settlement?.trashMonthlyReceived)}
                  meta={["Trash payments received for the current period."]}
                />
                <MonitoringCard
                  label="Trash Advance Outstanding"
                  value={rupiah(settlement?.trashAdvanceOutstanding)}
                  meta={["Advanced trash fees not reimbursed yet."]}
                  error={Number(settlement?.trashAdvanceOutstanding || 0) > 0}
                />
                <MonitoringCard
                  label="Trash Reimbursed"
                  value={rupiah(settlement?.trashReimbursed)}
                  meta={["Recorded reimbursement income."]}
                />
                <MonitoringCard
                  label="Trash Paid Direct"
                  value={rupiah(settlement?.trashPaidDirect)}
                  meta={["Trash fees paid without prior advance."]}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activePanel === "services" && <ServiceTestsPanel />}
    </div>
  );
}

const styles = {
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  panelTitle: { margin: 0 },
  muted: {
    margin: "4px 0 0",
    color: "var(--admin-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
  },
  paginationMeta: {
    color: "var(--admin-muted)",
    fontSize: 12,
    fontWeight: 700,
  },
  paginationActions: { display: "flex", gap: 8 },
  serviceCard: { display: "grid", gap: 14 },
  serviceActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  eventList: { display: "grid", gap: 6 },
  eventRow: {
    display: "grid",
    gridTemplateColumns: "minmax(100px,auto) minmax(0,1fr)",
    gap: 10,
    padding: "8px 10px",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    background: "var(--admin-row)",
    fontSize: 12,
  },
  pairingBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    padding: 12,
    border: "1px dashed #d97706",
    borderRadius: 12,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 18,
    background: "rgba(15,23,42,.58)",
  },
  modalBox: {
    width: "min(100%,430px)",
    display: "grid",
    gap: 14,
    padding: 20,
    border: "1px solid var(--admin-border)",
    borderRadius: 18,
    background: "var(--admin-card)",
    boxShadow: "0 22px 60px rgba(15,23,42,.3)",
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 10,
  },
};
