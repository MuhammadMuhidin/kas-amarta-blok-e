import "./page.css";

export default function AdminLoading() {
  return (
    <div className="admin-wrapper">
      <div style={styles.header}>
        <div style={{ ...styles.block, ...styles.home }} />
        <div style={{ ...styles.block, ...styles.title }} />
      </div>

      <div style={styles.tabs}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} style={{ ...styles.block, ...styles.tab }} />
        ))}
      </div>

      <div style={{ ...styles.block, ...styles.card }}>
        <div style={{ ...styles.line, width: "34%" }} />
        <div style={styles.formGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} style={{ ...styles.line, height: 44 }} />
          ))}
        </div>
      </div>

      <div style={styles.summaryGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={{ ...styles.block, ...styles.summary }} />
        ))}
      </div>

      <div style={{ ...styles.block, ...styles.table }}>
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            style={{
              ...styles.tableRow,
              opacity: index === 0 ? 0.9 : 0.65,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes adminSkeletonShimmer {
          0% { background-position: 140% 0; }
          100% { background-position: -140% 0; }
        }
      `}</style>
    </div>
  );
}

const shimmer = {
  backgroundImage:
    "linear-gradient(90deg, transparent, rgba(148,163,184,.22), transparent)",
  backgroundSize: "220% 100%",
  animation: "adminSkeletonShimmer 1.2s ease-in-out infinite",
};

const styles = {
  block: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid var(--admin-border)",
    backgroundColor: "var(--admin-row)",
    ...shimmer,
  },

  header: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
  },

  home: {
    width: 82,
    height: 36,
    borderRadius: 8,
  },

  title: {
    width: "min(360px, 82vw)",
    height: 34,
    borderRadius: 12,
  },

  tabs: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  tab: {
    width: 118,
    height: 42,
    borderRadius: 10,
  },

  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "var(--admin-card)",
    marginBottom: 18,
  },

  line: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
    ...shimmer,
  },

  formGrid: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },

  summary: {
    height: 78,
    borderRadius: 12,
  },

  table: {
    height: 360,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "var(--admin-card)",
  },

  tableRow: {
    height: 34,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "var(--admin-row)",
    border: "1px solid var(--admin-border)",
    ...shimmer,
  },
};
