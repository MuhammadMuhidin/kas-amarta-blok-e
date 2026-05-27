import { useEffect,useMemo,useState } from "react";
import MonitoringCard from "@/components/admin/MonitoringCard";
import { getCurrentPeriod } from "@/lib/depositUtils";

function IssueTable({title,rows,columns}) {
  if (!rows?.length) return null;
  return <div className="admin-monitor-detail"><h3>{title}</h3><div className="admin-table-wrapper"><table className="admin-table"><thead><tr>{columns.map((c)=><th key={c} className="admin-th">{c==="detail"?"Issue":c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className={i%2?"admin-row-alt":""}>{columns.map((c)=><td key={c} className="admin-td admin-issue-text">{r[c]}</td>)}</tr>)}</tbody></table></div></div>;
}

function Section({title,children}) {
  return <div className="admin-monitor-section" style={{marginBottom:20}}><h2 style={{margin:"0 0 12px"}}>{title}</h2>{children}</div>;
}

const rupiah = (v) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const n = (v) => Number.isFinite(Number(v||0)) ? Number(v||0) : 0;

function getSettlement({cashflows,deposits,trashRecords}) {
  const periodNow = getCurrentPeriod();
  const mainCash = cashflows.reduce((t,c)=>{
    const type = String(c.type||"").toLowerCase();
    if (type==="income") return t+n(c.amount);
    if (type==="expense") return t-n(c.amount);
    return t;
  },0);
  const recon = deposits
    .filter((d)=>String(d.status||"").toLowerCase()!=="paid")
    .reduce((t,d)=>t+n(d.amount)+n(d.trash_amount),0);
  const trashMonthly = trashRecords.reduce((t,r)=>{
    const period = String(r.date||"").slice(0,7);
    return period===periodNow ? t+n(r.amount) : t;
  },0);
  return {mainCash,recon,trashMonthly};
}

function fmtTime(value) {
  const d = new Date(value);
  if (!value || value==="unknown" || Number.isNaN(d.getTime())) return value || "unknown";
  return d.toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});
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

function getHealthStatus({loadingSettlement,rows,buildInfo,dailyBackup,paymentCashflowIntegrity,trashMismatch,suspiciousData}) {
  const sheetOk = !loadingSettlement && (rows.cashflows.length + rows.deposits.length + rows.trashRecords.length) > 0;
  const buildOk = Boolean(buildInfo);
  const backupOk = Boolean(dailyBackup?.ok);
  const integrityIssueCount = paymentCashflowIntegrity.length + trashMismatch.length + suspiciousData.length;
  const integrityOk = integrityIssueCount === 0;
  const reportReady = sheetOk && buildOk;
  const storageReady = rows.cashflows.some((item)=>String(item.receipt_url||"").trim()) ? "With receipt data" : "No receipt sample";

  return {
    sheetOk,
    buildOk,
    backupOk,
    integrityOk,
    reportReady,
    integrityIssueCount,
    storageReady,
  };
}

export default function MonitoringTab({loadingDailyBackup,dailyBackup,paymentCashflowIntegrity,trashMismatch,suspiciousData}) {
  const [buildInfo,setBuildInfo] = useState(null);
  const [loadingBuildInfo,setLoadingBuildInfo] = useState(false);
  const [loadingSettlement,setLoadingSettlement] = useState(false);
  const [rows,setRows] = useState({cashflows:[],deposits:[],trashRecords:[]});
  const settlement = useMemo(()=>getSettlement(rows),[rows]);
  const health = useMemo(()=>getHealthStatus({
    loadingSettlement,
    rows,
    buildInfo,
    dailyBackup,
    paymentCashflowIntegrity,
    trashMismatch,
    suspiciousData,
  }),[loadingSettlement,rows,buildInfo,dailyBackup,paymentCashflowIntegrity,trashMismatch,suspiciousData]);

  useEffect(()=>{
    let active = true;
    async function loadSettlement() {
      setLoadingSettlement(true);
      try {
        const endpoints = ["cashflow","deposit","trash"];
        const res = await Promise.all(endpoints.map((x)=>fetch(`/api/sheets/${x}`,{cache:"no-store"})));
        const data = await Promise.all(res.map((r)=>r.json()));
        if (active) setRows({
          cashflows:Array.isArray(data[0])?data[0]:[],
          deposits:Array.isArray(data[1])?data[1]:[],
          trashRecords:Array.isArray(data[2])?data[2]:[],
        });
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

  return <div className="admin-card">
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:18,flexWrap:"wrap",position:"static"}}>
      <div>
        <h2 style={{margin:"0 0 4px"}}>Monitoring</h2>
        <div style={{fontSize:13,color:"var(--admin-muted)",fontWeight:600}}>Settlement, status sistem, dan kualitas data.</div>
      </div>
      <BuildBadge loading={loadingBuildInfo} buildInfo={buildInfo} />
    </div>

    <Section title="Operational Health Check">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Sheets API" value={loadingSettlement?"Checking...":health.sheetOk?"Connected":"Need check"} meta={[health.sheetOk?`${rows.cashflows.length} cashflow, ${rows.deposits.length} booking, ${rows.trashRecords.length} trash rows loaded.`:"Data operasional belum terbaca."]} error={!loadingSettlement&&!health.sheetOk} />
        <MonitoringCard label="Build Metadata" value={loadingBuildInfo?"Checking...":health.buildOk?"Ready":"Missing"} meta={buildInfo?[`${String(buildInfo.platform||"unknown").toUpperCase()} - ${buildInfo.branch}`,`Commit: ${buildInfo.commitShort}`]:["Build info tidak tersedia."]} error={!loadingBuildInfo&&!health.buildOk} />
        <MonitoringCard label="Backup Health" value={loadingDailyBackup?"Checking...":health.backupOk?"Healthy":"Need check"} meta={health.backupOk?[`Last file: ${dailyBackup.name}`,`Retention: ${dailyBackup.count} backup files`]:["Backup harian belum valid."]} error={!loadingDailyBackup&&!health.backupOk} />
        <MonitoringCard label="Integrity Health" value={health.integrityOk?"Clean":`${health.integrityIssueCount} issue`} meta={[health.integrityOk?"No integrity issue detected.":"Ada issue yang perlu direview."]} error={!health.integrityOk} />
        <MonitoringCard label="Report Readiness" value={health.reportReady?"Ready":"At risk"} meta={[health.reportReady?"Data dan build metadata tersedia untuk report.":"Report bisa gagal jika data/build tidak sehat."]} error={!health.reportReady} />
        <MonitoringCard label="Receipt Storage" value={health.storageReady} meta={[health.storageReady==="With receipt data"?"Ada data receipt_url di cashflow.":"Belum ada sample receipt_url untuk dicek otomatis."]} />
      </div>
    </Section>

    <Section title="Settlement">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Saldo Kas Terkini" value={loadingSettlement?"Checking...":rupiah(settlement.mainCash)} meta={["Income dikurangi expense dari semua cashflow."]} />
        <MonitoringCard label="Saldo Rekonsiliasi" value={loadingSettlement?"Checking...":rupiah(settlement.recon)} meta={["Total booking payment yang belum paid."]} />
        <MonitoringCard label="Trash Payment Monthly" value={loadingSettlement?"Checking...":rupiah(settlement.trashMonthly)} meta={["Total trash.amount yang trash.date-nya masuk bulan berjalan."]} />
      </div>
    </Section>

    <Section title="Status Sistem">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Current Build" value={loadingBuildInfo?"Checking...":buildInfo?`${String(buildInfo.platform||"UNKNOWN").toUpperCase()} - ${buildInfo.branch}`:"Build info not found"} meta={buildInfo?[`Commit: ${buildInfo.commitShort}`,`Message: ${buildInfo.commitMessage||"unknown"}`,`Env: ${buildInfo.environment}`,`Built: ${fmtTime(buildInfo.buildTime)}`]:[]} error={!loadingBuildInfo&&!buildInfo} />
        <MonitoringCard label="Daily Backup Status" value={loadingDailyBackup?"Checking...":dailyBackup?.ok?dailyBackup.name:"Backup file not found"} meta={dailyBackup?.ok?[`Last created: ${dailyBackup.created_at}`,`Retention: ${dailyBackup?.count} backup files`]:[]} error={!loadingDailyBackup&&!dailyBackup?.ok} />
      </div>
    </Section>

    <Section title="Integrity & Data Quality">
      <div className="admin-monitor-grid">
        <MonitoringCard label="Payment Cashflow Integrity" value={`${paymentCashflowIntegrity.length} issue`} meta={[paymentCashflowIntegrity.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Trash Payment Integrity" value={`${trashMismatch.length} issue`} meta={[trashMismatch.length===0?"No issue detected":"Need review"]} />
        <MonitoringCard label="Data Quality Check" value={`${suspiciousData.length} issue`} meta={[suspiciousData.length===0?"No suspicious data":"Need review"]} />
      </div>
    </Section>

    <IssueTable title="Payment Cashflow Integrity" rows={paymentCashflowIntegrity} columns={["house","name","period","type","detail"]} />
    <IssueTable title="Trash Payment Integrity" rows={trashMismatch} columns={["house","name","period","detail"]} />
    <IssueTable title="Suspicious Data" rows={suspiciousData} columns={["sheet","row","type","detail"]} />
  </div>;
}
