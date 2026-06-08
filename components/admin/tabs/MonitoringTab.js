import { useEffect,useMemo,useState } from "react";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";

function IssueTable({title,rows,columns}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>{title}</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr>{columns.map((c)=><th key={c} className="admin-th">{c==="detail"?"Issue":c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className={i%2?"admin-row-alt admin-clickable-row":"admin-clickable-row"}>{columns.map((c)=><td key={c} className="admin-td admin-issue-text">{r[c]}</td>)}</tr>)}</tbody></table></div></div>;
}

function TrashIssueTable({rows,repairingPaymentId,onRepair}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>Payment ⇄ Trash Integrity</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th className="admin-th">house</th><th className="admin-th">name</th><th className="admin-th">period</th><th className="admin-th">Issue</th><th className="admin-th">Action</th></tr></thead><tbody>{rows.map((row,i)=>{
    const canRepair = row.type === "PAYMENT_WITHOUT_TRASH" && row.payment_id;
    const repairing = repairingPaymentId === row.payment_id;
    const rowClassName = [i%2?"admin-row-alt":"","admin-clickable-row",repairing?"monitoring-row-repairing":""].filter(Boolean).join(" ");
    return <tr key={`${row.type}-${row.payment_id || row.house}-${row.period}-${i}`} className={rowClassName}><td className="admin-td admin-issue-text">{row.house}</td><td className="admin-td admin-issue-text">{row.name}</td><td className="admin-td admin-issue-text">{row.period}</td><td className="admin-td admin-issue-text">{row.detail}</td><td className="admin-td admin-issue-text">{canRepair ? <button type="button" className="admin-small-btn monitoring-repair-btn" disabled={repairing || Boolean(repairingPaymentId)} onClick={()=>onRepair(row)}>{repairing ? "Repairing..." : "Repair"}</button> : <span style={{color:"var(--admin-muted)",fontSize:12}}>Manual review</span>}</td></tr>;
  })}</tbody></table></div></div>;
}

function ReimbursementIssueTable({rows,repairingPaymentId,onRepair}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>Trash Advance ⇄ Reimbursement Integrity</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th className="admin-th">house</th><th className="admin-th">name</th><th className="admin-th">period</th><th className="admin-th">Issue</th><th className="admin-th">Action</th></tr></thead><tbody>{rows.map((row,i)=>{
    const canRepair = row.type === "MISSING_REIMBURSEMENT" && row.payment_id;
    const repairing = repairingPaymentId === row.payment_id;
    const rowClassName = [i%2?"admin-row-alt":"","admin-clickable-row",repairing?"monitoring-row-repairing":""].filter(Boolean).join(" ");
    return <tr key={`${row.type}-${row.payment_id || row.house}-${row.period}-${i}`} className={rowClassName}><td className="admin-td admin-issue-text">{row.house}</td><td className="admin-td admin-issue-text">{row.name}</td><td className="admin-td admin-issue-text">{row.period}</td><td className="admin-td admin-issue-text">{row.detail}</td><td className="admin-td admin-issue-text">{canRepair ? <button type="button" className="admin-small-btn monitoring-repair-btn" disabled={repairing || Boolean(repairingPaymentId)} onClick={()=>onRepair(row)}>{repairing ? "Repairing..." : "Repair"}</button> : <span style={{color:"var(--admin-muted)",fontSize:12}}>Manual review</span>}</td></tr>;
  })}</tbody></table></div></div>;
}

function Section({title,children}) {
  return <div className="admin-monitor-section" style={{marginBottom:20}}><h2 style={{margin:"0 0 12px"}}>{title}</h2>{children}</div>;
}

const rupiah = (v) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const n = (v) => Number.isFinite(Number(v||0)) ? Number(v||0) : 0;
const normalize = (v) => String(v || "").trim();
const keyOf = (personId, period) => `${normalize(personId)}|${normalize(period)}`;

function parseTrashAdvanceRefId(refId) {
  const parts = normalize(refId).split("-");
  if (parts.length < 4 || parts[0].toUpperCase() !== "TRASHADV") return null;

  const period = `${parts.at(-2)}-${parts.at(-1)}`;
  if (!/^\d{4}-\d{2}$/.test(period)) return null;

  const personId = parts.slice(1, -2).join("-");
  if (!personId) return null;

  return { personId, period };
}

function parseTrashReimbursementRefId(refId) {
  const normalized = normalize(refId);
  const prefix = "TRASHREIMB-";
  if (!normalized.toUpperCase().startsWith(prefix)) return null;
  const paymentId = normalized.slice(prefix.length);
  return paymentId ? { paymentId } : null;
}

function getSettlement({cashflows,deposits,trashRecords,payments}) {
  const periodNow = getCurrentPeriod();
  const recon = deposits.filter((d)=>String(d.status||"").toLowerCase()!=="paid").reduce((t,d)=>t+n(d.amount)+n(d.trash_amount),0);
  const paymentById = new Map(payments.map((payment)=>[normalize(payment.id),payment]));
  const trashPayments = trashRecords.map((trash)=>{
    const payment = paymentById.get(normalize(trash.payment_id));
    return { trash, payment };
  }).filter(({payment})=>payment && normalize(payment.period) === periodNow);
  const trashPaymentKeys = new Set(trashPayments.map(({payment})=>keyOf(payment.person_id, payment.period)));
  const advanceRecords = cashflows.map((cashflow)=>{
    const parsed = parseTrashAdvanceRefId(cashflow.ref_id);
    return parsed ? { cashflow, ...parsed } : null;
  }).filter((item)=>item && normalize(item.cashflow.type).toLowerCase()==="expense" && item.period === periodNow);
  const reimbursementRecords = cashflows.map((cashflow)=>{
    const parsed = parseTrashReimbursementRefId(cashflow.ref_id);
    const payment = parsed ? paymentById.get(normalize(parsed.paymentId)) : null;
    return payment ? { cashflow, payment } : null;
  }).filter((item)=>item && normalize(item.cashflow.type).toLowerCase()==="income" && normalize(item.payment.period) === periodNow);
  const advanceKeys = new Set(advanceRecords.map((item)=>keyOf(item.personId,item.period)));
  const trashMonthlyReceived = trashPayments.reduce((total,{trash})=>total+n(trash.amount),0);
  const trashReimbursed = reimbursementRecords.reduce((total,item)=>total+n(item.cashflow.amount),0);
  const trashAdvanceOutstanding = advanceRecords.reduce((total,item)=>trashPaymentKeys.has(keyOf(item.personId,item.period)) ? total : total+n(item.cashflow.amount),0);
  const trashPaidDirect = trashPayments.reduce((total,{trash,payment})=>advanceKeys.has(keyOf(payment.person_id,payment.period)) ? total : total+n(trash.amount),0);

  return {recon,trashMonthlyReceived,trashAdvanceOutstanding,trashReimbursed,trashPaidDirect};
}

function fmtTime(value) {
  const d = new Date(value);
  if (!value || value==="unknown" || Number.isNaN(d.getTime())) return value || "unknown";
  return d.toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
}

function BuildBadge({loading,buildInfo}) {
  const ok = Boolean(buildInfo);
  const text = loading ? "Checking build..." : ok ? `${String(buildInfo.platform||"UNKNOWN").toUpperCase()} - ${buildInfo.branch}` : "Build info not found";
  const title = ok ? `Commit: ${buildInfo.commitShort}\nMessage: ${buildInfo.commitMessage||"unknown"}\nEnv: ${buildInfo.environment}\nBuilt: ${fmtTime(buildInfo.buildTime)}` : "";
  const dotClassName = loading ? "monitoring-build-dot monitoring-build-dot-loading" : ok ? "monitoring-build-dot monitoring-build-dot-ok" : "monitoring-build-dot monitoring-build-dot-error";
  return <div className="monitoring-build-badge" title={title} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,border:"1px solid var(--admin-border)",background:"var(--admin-row)",color:"var(--admin-muted)",fontSize:12,fontWeight:700,lineHeight:1.2,whiteSpace:"nowrap",position:"static",alignSelf:"flex-start",flexShrink:0}}>
    <span className={dotClassName} />
    <span>{text}</span>
  </div>;
}

function AlertTestCard({loading,result,onSend}) {
  const resultText = result?.message || "";
  const resultColor = result?.type === "error" ? "#dc2626" : result?.type === "success" ? "#16a34a" : "var(--admin-muted)";

  return <div className={loading ? "monitoring-alert-test-card monitoring-alert-test-card-loading" : "monitoring-alert-test-card"} style={{marginBottom:20,padding:16,borderRadius:16,border:"1px solid var(--admin-border)",background:"var(--admin-row)",display:"grid",gap:12}}>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div style={{minWidth:220,flex:"1 1 260px"}}>
        <h3 style={{margin:"0 0 4px"}}>Alert Channel Test</h3>
        <div style={{fontSize:13,color:"var(--admin-muted)",fontWeight:600,lineHeight:1.5}}>Send a test alert to WhatsApp and email to verify alert delivery.</div>
      </div>
      <button type="button" className="admin-small-btn admin-refresh-btn" disabled={loading} onClick={onSend} style={{minWidth:140}}>{loading ? "Sending..." : "Send Test Alert"}</button>
    </div>
    {resultText && <div className="monitoring-alert-result" style={{fontSize:12,fontWeight:800,color:resultColor,lineHeight:1.5}}>{resultText}</div>}
  </div>;
}

function DatabaseStatusCard({loading,connected,rows}) {
  const items = [
    {label:"Personal", value:rows.personal.length},
    {label:"Payment", value:rows.payments.length},
    {label:"Cashflow", value:rows.cashflows.length},
    {label:"Trash", value:rows.trashRecords.length},
    {label:"Deposit", value:rows.deposits.length},
  ];
  const totalRows = items.reduce((sum,item)=>sum+item.value,0);
  const statusText = loading ? "Checking..." : connected ? "Connected" : "Need check";
  const statusColor = loading ? "#64748b" : connected ? "#16a34a" : "#dc2626";

  return <div className="admin-status-card" style={{display:"grid",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
      <div>
        <div className="admin-status-label">Database API</div>
        <div className={connected ? "admin-status-value" : "admin-status-error"} style={{fontSize:30,lineHeight:1.1,marginTop:4}}>{loading ? "..." : totalRows.toLocaleString("id-ID")}</div>
        <div className="admin-status-meta">total rows loaded from Supabase</div>
      </div>
      <div style={{display:"inline-flex",alignItems:"center",gap:7,border:`1px solid ${statusColor}33`,background:`${statusColor}12`,color:statusColor,borderRadius:999,padding:"7px 10px",fontSize:12,fontWeight:900,whiteSpace:"nowrap"}}>
        <span style={{width:8,height:8,borderRadius:999,background:statusColor,display:"inline-block"}} />
        {statusText}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:8}}>
      {items.map((item)=><div key={item.label} style={{border:"1px solid var(--admin-border)",background:"var(--admin-row)",borderRadius:12,padding:"10px 11px"}}>
        <div className="admin-status-label" style={{fontSize:11}}>{item.label}</div>
        <div className="admin-status-value" style={{fontSize:21,lineHeight:1.15,marginTop:4}}>{loading ? "-" : item.value.toLocaleString("id-ID")}</div>
        <div className="admin-status-meta">rows</div>
      </div>)}
    </div>
  </div>;
}

function getHealthStatus({loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,trashMismatch,trashAdvanceReimbursementIntegrity,depositPaymentIntegrity,suspiciousData}) {
  const databaseOk = !loadingSettlement && (rows.personal.length + rows.cashflows.length + rows.deposits.length + rows.payments.length + rows.trashRecords.length) > 0;
  const buildOk = Boolean(buildInfo);
  const integrityIssueCount = paymentCashflowIntegrity.length + trashMismatch.length + trashAdvanceReimbursementIntegrity.length + depositPaymentIntegrity.length + suspiciousData.length;
  const integrityOk = integrityIssueCount === 0;
  const reportReady = databaseOk && buildOk;
  return { databaseOk, buildOk, integrityOk, reportReady, integrityIssueCount };
}

function getReceiptStorageView(loading, data) {
  if (loading) return { value: "Checking...", meta: ["Checking public access to R2 receipts."], error: false };
  if (!data) return { value: "Need check", meta: ["Receipt health check is not available yet."], error: true };
  if (data.status === "no_sample") return { value: "No receipt sample", meta: [data.message || "No receipt_url sample is available for automatic checking yet."], error: false };
  if (data.ok) {
    return { value: "Reachable", meta: [data.host ? `Host: ${data.host}` : "R2 public receipts are reachable.", data.status_code ? `HTTP ${data.status_code}` : data.message].filter(Boolean), error: false };
  }
  return { value: "Unreachable", meta: [data.message || "R2 public receipts are not reachable.", data.status_code ? `HTTP ${data.status_code}` : "Residents may not be able to open receipts."], error: true };
}

export default function MonitoringTab({paymentCashflowIntegrity,trashMismatch,trashAdvanceReimbursementIntegrity = [],depositPaymentIntegrity = [],suspiciousData,onRepairComplete}) {
  const [buildInfo,setBuildInfo] = useState(null);
  const [loadingBuildInfo,setLoadingBuildInfo] = useState(false);
  const [loadingSettlement,setLoadingSettlement] = useState(false);
  const [loadingReceiptStorage,setLoadingReceiptStorage] = useState(false);
  const [receiptStorage,setReceiptStorage] = useState(null);
  const [repairingPaymentId,setRepairingPaymentId] = useState("");
  const [repairingReimbursementPaymentId,setRepairingReimbursementPaymentId] = useState("");
  const [repairedPaymentIds,setRepairedPaymentIds] = useState([]);
  const [repairedReimbursementPaymentIds,setRepairedReimbursementPaymentIds] = useState([]);
  const [sendingTestAlert,setSendingTestAlert] = useState(false);
  const [testAlertResult,setTestAlertResult] = useState(null);
  const [rows,setRows] = useState({personal:[],cashflows:[],deposits:[],payments:[],trashRecords:[]});
  const displayedTrashMismatch = useMemo(()=>trashMismatch.filter((row)=>!repairedPaymentIds.includes(row.payment_id)),[trashMismatch,repairedPaymentIds]);
  const displayedReimbursementIssues = useMemo(()=>trashAdvanceReimbursementIntegrity.filter((row)=>!repairedReimbursementPaymentIds.includes(row.payment_id)),[trashAdvanceReimbursementIntegrity,repairedReimbursementPaymentIds]);
  const settlement = useMemo(()=>getSettlement(rows),[rows]);
  const health = useMemo(()=>getHealthStatus({loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,trashMismatch: displayedTrashMismatch,trashAdvanceReimbursementIntegrity: displayedReimbursementIssues,depositPaymentIntegrity,suspiciousData}),[loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,displayedTrashMismatch,displayedReimbursementIssues,depositPaymentIntegrity,suspiciousData]);
  const receiptStorageView = useMemo(()=>getReceiptStorageView(loadingReceiptStorage,receiptStorage),[loadingReceiptStorage,receiptStorage]);

  async function handleRepairTrash(row) {
    if (!row?.payment_id || repairingPaymentId) return;
    setRepairingPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/repair", "POST", { payment_id: row.payment_id });
      setRepairedPaymentIds((prev)=>prev.includes(row.payment_id) ? prev : [...prev,row.payment_id]);
      await onRepairComplete?.();
    } finally {
      setRepairingPaymentId("");
    }
  }

  async function handleRepairReimbursement(row) {
    if (!row?.payment_id || repairingReimbursementPaymentId) return;
    setRepairingReimbursementPaymentId(row.payment_id);
    try {
      await sendJson("/api/sheets/trash/reimbursement-repair", "POST", { payment_id: row.payment_id });
      setRepairedReimbursementPaymentIds((prev)=>prev.includes(row.payment_id) ? prev : [...prev,row.payment_id]);
      await onRepairComplete?.();
    } finally {
      setRepairingReimbursementPaymentId("");
    }
  }

  async function handleSendTestAlert() {
    if (sendingTestAlert) return;
    setSendingTestAlert(true);
    setTestAlertResult(null);

    try {
      const period = getCurrentPeriod();
      const data = await sendJson("/api/waha/workflow", "POST", {
        period,
        source: "admin-test-alert",
        message: `[TEST] Admin alert channel test for ${period}. WhatsApp and email alert delivery should be verified from Monitoring.`,
        emailSubject: `[TEST] Amarta Admin Alert - ${period}`,
      });
      const emailStatus = data?.email?.ok ? " Email sent." : data?.email?.skipped ? ` Email skipped: ${data.email.reason}.` : data?.email?.error ? ` Email failed: ${data.email.error}.` : "";
      setTestAlertResult({type:data?.email?.error ? "error" : "success",message:`Test alert sent to WhatsApp.${emailStatus}`});
    } catch (error) {
      setTestAlertResult({type:"error",message:error.message || "Failed to send test alert"});
    } finally {
      setSendingTestAlert(false);
    }
  }

  useEffect(()=>{
    let active = true;
    async function loadSettlement() {
      setLoadingSettlement(true);
      try {
        const endpoints = ["personal","payment","cashflow","trash","deposit"];
        const res = await Promise.all(endpoints.map((x)=>fetch(`/api/sheets/${x}`,{cache:"no-store"})));
        const data = await Promise.all(res.map((r)=>r.json()));
        if (active) setRows({
          personal:Array.isArray(data[0])?data[0]:[],
          payments:Array.isArray(data[1])?data[1]:[],
          cashflows:Array.isArray(data[2])?data[2]:[],
          trashRecords:Array.isArray(data[3])?data[3]:[],
          deposits:Array.isArray(data[4])?data[4]:[],
        });
      } catch {
        if (active) setRows({personal:[],cashflows:[],deposits:[],payments:[],trashRecords:[]});
      } finally {
        if (active) setLoadingSettlement(false);
      }
    }
    loadSettlement();
    return ()=>{active=false};
  },[]);

  useEffect(()=>{
    let active = true;
    async function loadBuildInfo() {
      setLoadingBuildInfo(true);
      try {
        const res = await fetch("/api/build-info",{cache:"no-store"});
        const data = await res.json();
        if (active) setBuildInfo(data?.build||null);
      } catch {
        if (active) setBuildInfo(null);
      } finally {
        if (active) setLoadingBuildInfo(false);
      }
    }
    loadBuildInfo();
    return ()=>{active=false};
  },[]);

  useEffect(()=>{
    let active = true;
    async function loadReceiptStorage() {
      setLoadingReceiptStorage(true);
      try {
        const res = await fetch("/api/health/receipt-storage",{cache:"no-store"});
        const data = await res.json();
        if (active) setReceiptStorage(data);
      } catch (error) {
        if (active) setReceiptStorage({ok:false,status:"error",message:error.message || "Failed to check R2 public receipts."});
      } finally {
        if (active) setLoadingReceiptStorage(false);
      }
    }
    loadReceiptStorage();
    return ()=>{active=false};
  },[]);

  return <div className="admin-card">
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:18,flexWrap:"wrap",position:"static"}}>
      <div>
        <h2 style={{margin:"0 0 4px"}}>Monitoring</h2>
        <div style={{fontSize:13,color:"var(--admin-muted)",fontWeight:600}}>Settlement, system status, and data quality.</div>
      </div>
      <BuildBadge loading={loadingBuildInfo} buildInfo={buildInfo} />
    </div>

    <AlertTestCard loading={sendingTestAlert} result={testAlertResult} onSend={handleSendTestAlert} />

    <Section title="Operational Health Check">
      <div className="admin-monitor-grid">
        <DatabaseStatusCard loading={loadingSettlement} connected={health.databaseOk} rows={rows} />
        <MonitoringCard label="Integrity Health" value={health.integrityOk?"Clean":`${health.integrityIssueCount} issue`} meta={[health.integrityOk?"No integrity issue detected.":"There are issues that need review."]} error={!health.integrityOk} />
        <MonitoringCard label="Report Readiness" value={health.reportReady?"Ready":"At risk"} meta={[health.reportReady?"Data and build metadata are available for reports.":"Reports may fail if data/build status is unhealthy."]} error={!health.reportReady} />
        <MonitoringCard label="Receipt Storage" value={receiptStorageView.value} meta={receiptStorageView.meta} error={receiptStorageView.error} />
      </div>
    </Section>

    <Section title="Settlement">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Reconciliation Balance" value={loadingSettlement?"Checking...":rupiah(settlement.recon)} meta={["Total unpaid booking payments."]} />
        <MonitoringCard label="Monthly Trash Received" value={loadingSettlement?"Checking...":rupiah(settlement.trashMonthlyReceived)} meta={["Trash fee payments received for the current period."]} />
        <MonitoringCard label="Trash Advance Outstanding" value={loadingSettlement?"Checking...":rupiah(settlement.trashAdvanceOutstanding)} meta={["Advanced trash fees not reimbursed by residents yet."]} error={!loadingSettlement && settlement.trashAdvanceOutstanding > 0} />
        <MonitoringCard label="Trash Reimbursed" value={loadingSettlement?"Checking...":rupiah(settlement.trashReimbursed)} meta={["Recorded reimbursement income from trash advance."]} />
        <MonitoringCard label="Trash Paid Direct" value={loadingSettlement?"Checking...":rupiah(settlement.trashPaidDirect)} meta={["Trash fees paid without prior cash advance."]} />
      </div>
    </Section>

    <Section title="System Status">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Current Build" value={loadingBuildInfo?"Checking...":buildInfo?`${String(buildInfo.platform||"UNKNOWN").toUpperCase()} - ${buildInfo.branch}`:"Build info not found"} meta={buildInfo?[`Commit: ${buildInfo.commitShort}`,`Message: ${buildInfo.commitMessage||"unknown"}`,`Env: ${buildInfo.environment}`,`Built: ${fmtTime(buildInfo.buildTime)}`]:[]} error={!loadingBuildInfo&&!buildInfo} />
      </div>
    </Section>

    <Section title="Integrity & Data Quality">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Payment ⇄ Cashflow Integrity" value={`${paymentCashflowIntegrity.length} issue`} meta={[paymentCashflowIntegrity.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Payment ⇄ Trash Integrity" value={`${displayedTrashMismatch.length} issue`} meta={[displayedTrashMismatch.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Trash Advance ⇄ Reimbursement Integrity" value={`${displayedReimbursementIssues.length} issue`} meta={[displayedReimbursementIssues.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Payment ⇄ Deposit Integrity" value={`${depositPaymentIntegrity.length} issue`} meta={[depositPaymentIntegrity.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Data Quality Check" value={`${suspiciousData.length} issue`} meta={[suspiciousData.length===0?"No suspicious data":"Need review"]} />
      </div>
    </Section>

    <IssueTable title="Payment ⇄ Cashflow Integrity" rows={paymentCashflowIntegrity} columns={["house","name","period","type","detail"]} />
    <TrashIssueTable rows={displayedTrashMismatch} repairingPaymentId={repairingPaymentId} onRepair={handleRepairTrash} />
    <ReimbursementIssueTable rows={displayedReimbursementIssues} repairingPaymentId={repairingReimbursementPaymentId} onRepair={handleRepairReimbursement} />
    <IssueTable title="Payment ⇄ Deposit Integrity" rows={depositPaymentIntegrity} columns={["house","name","period","type","detail"]} />
    <IssueTable title="Suspicious Data" rows={suspiciousData} columns={["sheet","row","type","detail"]} />
  </div>;
}
