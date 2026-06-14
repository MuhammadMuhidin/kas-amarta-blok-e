import { useApprovalNeedActionCount } from "@/components/admin/ApprovalNeedActionContext";

function StatusCard({ label, value, meta = [], metaActions = [], error = false }) {
  return (
    <div className="admin-status-card">
      <div className="admin-status-label">{label}</div>
      <div className={error ? "admin-status-error" : "admin-status-value"}>{value}</div>
      {meta.map((item, index) => {
        const action = metaActions[index];
        return (
          <div key={`${item}-${index}`} className={`admin-status-meta${action ? " admin-status-meta-action-row" : ""}`}>
            <span>{item}</span>
            {action ? (
              <button type="button" className="admin-insight-link" onClick={action.onClick}>
                {action.label}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function MonitoringCard(props) {
  const approvalNeedActionCount = useApprovalNeedActionCount();
  const showApprovalNeeded = props.label === "Monitoring Issue" && approvalNeedActionCount !== null;
  const requestLabel = approvalNeedActionCount === 1 ? "request" : "requests";

  return (
    <>
      <StatusCard {...props} />
      {showApprovalNeeded ? (
        <StatusCard
          label="Approval Needed"
          value={`${approvalNeedActionCount} ${requestLabel}`}
          meta={[approvalNeedActionCount > 0 ? "Need action" : "No approval needed"]}
          error={approvalNeedActionCount > 0}
        />
      ) : null}
    </>
  );
}
