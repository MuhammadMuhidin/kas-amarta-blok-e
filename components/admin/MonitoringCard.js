export default function MonitoringCard({
  label,
  value,
  meta = [],
  metaActions = [],
  error = false,
}) {
  return (
    <div className="admin-status-card">
      <div className="admin-status-label">{label}</div>
      <div className={error ? "admin-status-error" : "admin-status-value"}>
        {value}
      </div>
      {meta.map((item, index) => {
        const action = metaActions[index];

        return (
          <div key={item} className={`admin-status-meta${action ? " admin-status-meta-action-row" : ""}`}>
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
