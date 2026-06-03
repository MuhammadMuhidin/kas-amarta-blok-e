"use client";

import AdminActionButton from "@/components/admin/AdminActionButton";

export default function AdminConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  children,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>{title}</div>
          {description && <div style={styles.description}>{description}</div>}
        </div>

        {children && <div style={styles.body}>{children}</div>}

        <div style={styles.footer}>
          <AdminActionButton onClick={onCancel} disabled={loading}>
            {cancelText}
          </AdminActionButton>
          <AdminActionButton onClick={onConfirm} loading={loading} loadingText="Sending...">
            {confirmText}
          </AdminActionButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "rgba(2, 6, 23, 0.68)",
  },
  modal: {
    width: "100%",
    maxWidth: 580,
    maxHeight: "86vh",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    borderRadius: 18,
    border: "1px solid var(--admin-border)",
    background: "var(--admin-card)",
    color: "var(--admin-text)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
  },
  header: {
    padding: 18,
    borderBottom: "1px solid var(--admin-border)",
  },
  title: {
    fontSize: 17,
    fontWeight: 900,
    marginBottom: 5,
  },
  description: {
    color: "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body: {
    minHeight: 0,
    overflow: "auto",
    padding: 18,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 14,
    borderTop: "1px solid var(--admin-border)",
    background: "var(--admin-row)",
    flexWrap: "wrap",
  },
};