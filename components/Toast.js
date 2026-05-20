"use client";

export default function Toast({ show, type = "info", message }) {
  if (!show) return null;

  const config = {
    success: {
      color: "#16a34a",
      bg: "rgba(240,253,244,.96)",
      border: "#bbf7d0",
      icon: "✓",
    },
    error: {
      color: "#dc2626",
      bg: "rgba(254,242,242,.96)",
      border: "#fecaca",
      icon: "✕",
    },
    warning: {
      color: "#d97706",
      bg: "rgba(255,251,235,.96)",
      border: "#fed7aa",
      icon: "!",
    },
    info: {
      color: "#2563eb",
      bg: "rgba(239,246,255,.96)",
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
          animation: toastEnter 0.24s ease;
        }

        @keyframes toastEnter {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    top: 18,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 99999,
    width: "calc(100% - 24px)",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },

  toast: {
    width: "100%",
    maxWidth: 420,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid",
    backdropFilter: "blur(12px)",
    boxShadow: "0 20px 50px rgba(15,23,42,.18)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontFamily: "system-ui",
    pointerEvents: "auto",
  },

  icon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
    boxShadow: "0 8px 20px rgba(0,0,0,.12)",
  },

  message: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
};
