"use client";

export default function Toast({ show, type = "info", message }) {
  if (!show) return null;

  const config = {
    success: {
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      icon: "✓",
    },
    error: {
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
      icon: "✕",
    },
    warning: {
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fed7aa",
      icon: "!",
    },
    info: {
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
      icon: "i",
    },
  };

  const current = config[type] || config.info;

  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.toast,
          background: current.bg,
          borderColor: current.border,
        }}
      >
        <div
          style={{
            ...styles.icon,
            background: current.color,
          }}
        >
          {current.icon}
        </div>

        <p
          style={{
            ...styles.message,
            color: current.color,
          }}
        >
          {message}
        </p>
      </div>

      <style jsx>{`
        div {
          animation: slideIn 0.25s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    top: 20,
    right: 20,
    zIndex: 9999,
  },

  toast: {
    minWidth: 280,
    maxWidth: 360,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.16)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontFamily: "system-ui",
  },

  icon: {
    width: 26,
    height: 26,
    borderRadius: "999px",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
  },

  message: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.4,
  },
};
