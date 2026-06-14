"use client";

import LoadingButtonContent from "@/components/admin/LoadingButtonContent";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Yes",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDark = false,
  loading = false,
  hideCancel = false,
  overlayStyle = {},
  modalStyle = {},
}) {
  if (!open) return null;

  return (
    <div style={{ ...styles.overlay, ...overlayStyle }}>
      <div
        style={{
          ...styles.modal,
          background: isDark ? "#111827" : "#fff",
          border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
          ...modalStyle,
        }}
      >
        <h3
          style={{
            ...styles.title,
            color: isDark ? "#f8fafc" : "#0f172a",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            ...styles.message,
            color: isDark ? "#94a3b8" : "#64748b",
          }}
        >
          {message}
        </p>

        <div style={styles.actions}>
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                ...styles.cancel,
                background: isDark ? "#1e293b" : "#fff",
                color: isDark ? "#f8fafc" : "#0f172a",
                border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.55 : 1,
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              ...styles.confirm,
              background: loading ? "#3730a3" : styles.confirm.background,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <LoadingButtonContent loading loadingText="">
                {confirmText}
              </LoadingButtonContent>
            ) : (
              confirmText
            )}
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
    background: "rgba(15,23,42,.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
    boxShadow: "0 30px 80px rgba(15,23,42,.28)",
    fontFamily: "system-ui",
  },

  title: {
    margin: 0,
    fontSize: 18,
  },

  message: {
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
    fontWeight: 700,
  },

  confirm: {
    minWidth: 82,
    minHeight: 40,
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
};
