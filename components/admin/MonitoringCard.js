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
          <div key={item} className="admin-status-meta" style={action ? styles.metaWithAction : undefined}>
            <span>{item}</span>
            {action ? (
              <button type="button" style={styles.metaActionButton} onClick={action.onClick}>
                {action.label}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  metaWithAction: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  metaActionButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "var(--admin-primary, #2563eb)",
    font: "inherit",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
};
