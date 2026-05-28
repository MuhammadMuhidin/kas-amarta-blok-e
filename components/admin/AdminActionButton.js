"use client";

export default function AdminActionButton({
  children,
  className = "admin-small-btn",
  disabled = false,
  loading = false,
  loadingText = "Memproses...",
  onClick,
  type = "button",
}) {
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {loading && <span style={styles.spinner} aria-hidden="true" />}
      <span>{loading ? loadingText : children}</span>

      <style jsx>{`
        @keyframes admin-action-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}

const styles = {
  spinner: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid rgba(2, 6, 23, 0.28)",
    borderTopColor: "#020617",
    animation: "admin-action-spin 0.7s linear infinite",
    flex: "0 0 auto",
  },
};
