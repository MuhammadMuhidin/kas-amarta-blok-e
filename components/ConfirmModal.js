"use client";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Ya",
  cancelText = "Batal",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>
          {title}
        </h3>

        <p style={styles.message}>
          {message}
        </p>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancel}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={styles.confirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "rgba(15,23,42,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "100%",
    maxWidth: 360,
    background: "#fff",
    borderRadius: 20,
    padding: 22,
    boxShadow:
      "0 30px 80px rgba(15,23,42,.28)",
    fontFamily: "system-ui",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
  },

  message: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
    margin: "12px 0 20px",
  },

  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },

  cancel: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  confirm: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
};
