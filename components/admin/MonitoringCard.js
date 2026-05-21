export default function MonitoringCard({
  label,
  value,
  meta = [],
  error = false,
}) {
  return (
    <div className="admin-status-card">
      <div className="admin-status-label">{label}</div>
      <div className={error ? "admin-status-error" : "admin-status-value"}>
        {value}
      </div>
      {meta.map((item) => (
        <div key={item} className="admin-status-meta">
          {item}
        </div>
      ))}
    </div>
  );
}
