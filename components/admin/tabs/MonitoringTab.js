import { useEffect,useMemo,useState } from "react";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { sendJson } from "@/components/admin/adminClientApi";
import { getCurrentPeriod } from "@/lib/depositUtils";

function IssueTable({title,rows,columns}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>{title}</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr>{columns.map((c)=><th key={c} className="admin-th">{c==="detail"?"Issue":c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className={i%2?"admin-row-alt":""}>{columns.map((c)=><td key={c} className="admin-td admin-issue-text">{r[c]}</td>)}</tr>)}</tbody></table></div></div>;
}

function TrashIssueTable({rows,repairingPaymentId,onRepair}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>Trash Payment Integrity</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th className="admin-th">house</th><th className="admin-th">name</th><th className="admin-th">period</th><th className="admin-th">Issue</th><th className="admin-th">Action</th></tr></thead><tbody>{rows.map((row,i)=>{
    const canRepair = row.type === "PAYMENT_WITHOUT_TRASH" && row.payment_id;
    const repairing = repairingPaymentId === row.payment_id;
    return <tr key={`${row.type}-${row.payment_id || row.house}-${row.period}-${i}`} className={i%2?"admin-row-alt":""}><td className="admin-td admin-issue-text">{row.house}</td><td className="admin-td admin-issue-text">{row.name}</td><td className="admin-td admin-issue-text">{row.period}</td><td className="admin-td admin-issue-text">{row.detail}</td><td className="admin-td admin-issue-text">{canRepair ? <button type="button" className="admin-small-btn" disabled={repairing || Boolean(repairingPaymentId)} onClick={()=>onRepair(row)}>{repairing ? "Repairing..." : "Repair"}</button> : <span style={{color:"var(--admin-muted)",fontSize:12}}>Manual review</span>}</td></tr>;
  })}</tbody></table></div></div>;
}

function Section({title,children}) {
  return <div className="admin-monitor-section" style={{marginBottom:20}}><h2 style={{margin:"0 0 12px"}}>{title}</h2>{children}</div>;
}

const rupiah = (v) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const n = (v) => Number.isFinite(Number(v||0)) ? Number(v||0) : 0;

function getSettlement({deposits,trashRecords}) {
  const periodNow = getCurrentPeriod();
  const recon = deposits.filter((d)=>String(d.status||"").toLowerCase()!=="paid").reduce((t,d)=>t+n(d.amount)+n(d.trash_amount),0);
  const trashMonthly = trashRecords.reduce((t,r)=>{
    const period = String(r.date||"").slice(0,7);
    return period===periodNow ? t+n(r.amount) : t;
  },0);
  return {recon,trashMonthly};
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
  return <div title={title} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,border:"1px solid var(--admin-border)",background:"var(--admin-row)",color:"var(--admin-muted)",fontSize:12,fontWeight:700,lineHeight:1.2,whiteSpace:"nowrap",position:"static",alignSelf:"flex-start",flexShrink:0}}>
    <span style={{width:7,height:7,borderRadius:999,background:ok?"#16a34a":"#dc2626",display:"inline-block",flexShrink:0}} />
    <span>{text}</span>
  </div>;
}

function AlertTestCard({loading,result,onSend}) {
  const resultText = result?.message || "";
  const resultColor = result?.type === "error" ? "#dc2626" : result?.type === "success" ? "#16a34a" : "var(--admin-muted)";

  return <div style={{marginBottom:20,padding:16,borderRadius:16,border:"1px solid var(--admin-border)",background:"var(--admin-row)",display:"grid",gap:12}}>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div style={{minWidth:220,flex:"1 1 260px"}}>
        <h3 style={{margin:"0 0 4px"}}>Alert Channel Test</h3>
        <div style={{fontSize:13,color:"var(--admin-muted)",fontWeight:600,lineHeight:1.5}}>Send a test alert to WhatsApp and email to verify alert delivery.</div>
      </div>
      <button type="button" className="admin-small-btn" disabled={loading} onClick={onSend} style={{minWidth:140}}>{loading ? "Sending..." : "Send Test Alert"}</button>
    </div>
    {resultText && <div style={{fontSize:12,fontWeight:800,color:resultColor,lineHeight:1.5}}>{resultText}</div>}
  </div>;
}

function getHealthStatus({loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,trashMismatch,suspiciousData}) {
  const sheetOk = !loadingSettlement && (rows.cashflows.length + rows.deposits.length + rows.trashRecords.length) > 0;
  const buildOk = Boolean(buildInfo);
  const integrityIssueCount = paymentCashflowIntegrity.length + trashMismatch.length + suspiciousData.length;
  const integrityOk = integrityIssueCount === 0;
  const reportReady = sheetOk && buildOk;
  return { sheetOk, buildOk, integrityOk, reportReady, integrityIssueCount };
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

export default function MonitoringTab({loadingDailyBackup,dailyBackup,paymentCashflowIntegrity,trashMismatch,suspiciousData,onRepairComplete}) {
  const [buildInfo,setBuildInfo] = useState(null);
  const [loadingBuildInfo,setLoadingBuildInfo] = useState(false);
  const [loadingSettlement,setLoadingSettlement] = useState(false);
  const [loadingReceiptStorage,setLoadingReceiptStorage] = useState(false);
  const [receiptStorage,setReceiptStorage] = useState(null);
  const [repairingPaymentId,setRepairingPaymentId] = useState("");
  const [repairedPaymentIds,setRepairedPaymentIds] = useState([]);
  const [sendingTestAlert,setSendingTestAlert] = useState(false);
  const [testAlertResult,setTestAlertResult] = useState(null);
  const [rows,setRows] = useState({cashflows:[],deposits:[],trashRecords:[]});
  const displayedTrashMismatch = useMemo(()=>trashMismatch.filter((row)=>!repairedPaymentIds.includes(row.payment_id)),[trashMismatch,repairedPaymentIds]);
  const settlement = useMemo(()=>getSettlement(rows),[rows]);
  const health = useMemo(()=>getHealthStatus({loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,trashMismatch: displayedTrashMismatch,suspiciousData}),[loadingSettlement,rows,buildInfo,paymentCashflowIntegrity,displayedTrashMismatch,suspiciousData]);
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
        const endpoints = ["cashflow","deposit","trash"];
        const res = await Promise.all(endpoints.map((x)=>fetch(`/api/sheets/${x}`,{cache:"no-store"})));
        const data = await Promise.all(res.map((r)=>r.json()));
        if (active) setRows({cashflows:Array.isArray(data[0])?data[0]:[],deposits:Array.isArray(data[1])?data[1]:[],trashRecords:Array.isArray(data[2])?data[2]:[]});
      } catch {
        if (active) setRows({cashflows:[],deposits:[],trashRecords:[]});
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
    if (loadingDailyBackup || !buildInfo) loadBuildInfo();
    return ()=>{active=false};
  },[loadingDailyBackup]);

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
        <MonitoringCard label="Sheets API" value={loadingSettlement?"Checking...":health.sheetOk?"Connected":"Need check"} meta={[health.sheetOk?`${rows.cashflows.length} cashflow, ${rows.deposits.length} booking, ${rows.trashRecords.length} trash rows loaded.`:"Operational data has not been read yet."]} error={!loadingSettlement&&!health.sheetOk} />
        <MonitoringCard label="Integrity Health" value={health.integrityOk?"Clean":`${health.integrityIssueCount} issue`} meta={[health.integrityOk?"No integrity issue detected.":"There are issues that need review."]} error={!health.integrityOk} />
        <MonitoringCard label="Report Readiness" value={health.reportReady?"Ready":"At risk"} meta={[health.reportReady?"Data and build metadata are available for reports.":"Reports may fail if data/build status is unhealthy."]} error={!health.reportReady} />
        <MonitoringCard label="Receipt Storage" value={receiptStorageView.value} meta={receiptStorageView.meta} error={receiptStorageView.error} />
      </div>
    </Section>

    <Section title="Settlement">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Reconciliation Balance" value={loadingSettlement?"Checking...":rupiah(settlement.recon)} meta={["Total unpaid booking payments."]} />
        <MonitoringCard label="Monthly Trash Payment" value={loadingSettlement?"Checking...":rupiah(settlement.trashMonthly)} meta={["Total trash fee payments received in the current month."]} />
      </div>
    </Section>

    <Section title="System Status">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Current Build" value={loadingBuildInfo?"Checking...":buildInfo?`${String(buildInfo.platform||"UNKNOWN").toUpperCase()} - ${buildInfo.branch}`:"Build info not found"} meta={buildInfo?[`Commit: ${buildInfo.commitShort}`,`Message: ${buildInfo.commitMessage||"unknown"}`,`Env: ${buildInfo.environment}`,`Built: ${fmtTime(buildInfo.buildTime)}`]:[]} error={!loadingBuildInfo&&!buildInfo} />
        <MonitoringCard label="Daily Backup Status" value={loadingDailyBackup?"Checking...":dailyBackup?.ok?dailyBackup.name:"Backup file not found"} meta={dailyBackup?.ok?[`Last created: ${dailyBackup.created_at}`,`Retention: ${dailyBackup?.count} backup files`]:[]} error={!loadingDailyBackup&&!dailyBackup?.ok} />
      </div>
    </Section>

    <Section title="Integrity & Data Quality">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Payment Cashflow Integrity" value={`${paymentCashflowIntegrity.length} issue`} meta={[paymentCashflowIntegrity.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Trash Payment Integrity" value={`${displayedTrashMismatch.length} issue`} meta={[displayedTrashMismatch.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Data Quality Check" value={`${suspiciousData.length} issue`} meta={[suspiciousData.length===0?"No suspicious data":"Need review"]} />
      </div>
    </Section>

    <IssueTable title="Payment Cashflow Integrity" rows={paymentCashflowIntegrity} columns={["house","name","period","type","detail"]} />
    <TrashIssueTable title="Trash Payment Integrity" rows={displayedTrashMismatch} repairingPaymentId={repairingPaymentId} onRepair={handleRepairTrash} />
    <IssueTable title="Suspicious Data" rows={suspiciousData} columns={["sheet","row","type","detail"]} />
  </div>;
}