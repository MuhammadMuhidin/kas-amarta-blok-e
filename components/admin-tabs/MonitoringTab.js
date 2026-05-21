import { useEffect, useState } from "react";
import MonitoringCard from "@/components/admin/MonitoringCard";

function IssueTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null;

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
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 ? "admin-row-alt" : ""}>
                {columns.map((column) => (
                  <td key={column} className="admin-td admin-issue-text">
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBuildTime(value) {
  if (!value || value === "unknown") return "unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPlatform(value) {
  if (!value) return "UNKNOWN";

  return value.toUpperCase();
}

export default function MonitoringTab({
  loadingDailyBackup,
  dailyBackup,
  paymentCashflowIntegrity,
  trashMismatch,
  suspiciousData,
}) {
  const [buildInfo, setBuildInfo] = useState(null);
  const [loadingBuildInfo, setLoadingBuildInfo] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBuildInfo() {
      setLoadingBuildInfo(true);

      try {
        const res = await fetch("/api/build-info", {
          cache: "no-store",
        });

        const data = await res.json();

        if (active) {
          setBuildInfo(data?.build || null);
        }
      } catch {
        if (active) {
          setBuildInfo(null);
        }
      } finally {
        if (active) {
          setLoadingBuildInfo(false);
        }
      }
    }

    if (loadingDailyBackup || !buildInfo) {
      loadBuildInfo();
    }

    return () => {
      active = false;
    };
  }, [loadingDailyBackup]);

  return (
    <div className="admin-card">
      <div className="admin-monitor-grid">
        <MonitoringCard
          label="Current Build"
          value={
            loadingBuildInfo
              ? "Checking..."
              : buildInfo
                ? `${formatPlatform(buildInfo.platform)} • ${buildInfo.branch}`
                : "Build info not found"
          }
          meta={
            buildInfo
              ? [
                  `Commit: ${buildInfo.commitShort}`,
                  `Message: ${buildInfo.commitMessage || "unknown"}`,
                  `Env: ${buildInfo.environment}`,
                  `Built: ${formatBuildTime(buildInfo.buildTime)}`,
                ]
              : []
          }
          error={!loadingBuildInfo && !buildInfo}
        />

        <MonitoringCard
          label="Daily Backup Status"
          value={
            loadingDailyBackup
              ? "Checking..."
              : dailyBackup?.ok
                ? dailyBackup.name
                : "Backup file not found"
          }
          meta={
            dailyBackup?.ok
              ? [
                  `Last created: ${dailyBackup.created_at}`,
                  `Retention: ${dailyBackup?.count} backup files`,
                ]
              : []
          }
          error={!loadingDailyBackup && !dailyBackup?.ok}
        />

        <MonitoringCard
          label="Payment Cashflow Integrity"
          value={`${paymentCashflowIntegrity.length} issue`}
          meta={[
            paymentCashflowIntegrity.length === 0
              ? "No issue detected"
              : "Need review",
          ]}
        />

        <MonitoringCard
          label="Trash Payment Integrity"
          value={`${trashMismatch.length} issue`}
          meta={[
            trashMismatch.length === 0
              ? "No issue detected"
              : "Need review",
          ]}
        />

        <MonitoringCard
          label="Data Quality Check"
          value={`${suspiciousData.length} issue`}
          meta={[
            suspiciousData.length === 0
              ? "No suspicious data"
              : "Need review",
          ]}
        />
      </div>

      <IssueTable
        title="Payment Cashflow Integrity"
        rows={paymentCashflowIntegrity}
        columns={["house", "name", "period", "type", "detail"]}
      />

      <IssueTable
        title="Trash Payment Integrity"
        rows={trashMismatch}
        columns={["house", "name", "period", "detail"]}
      />

      <IssueTable
        title="Suspicious Data"
        rows={suspiciousData}
        columns={["sheet", "row", "type", "detail"]}
      />
    </div>
  );
}
