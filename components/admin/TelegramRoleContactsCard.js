"use client";

import AdminDataSkeleton from "@/components/admin/AdminDataSkeleton";
import LoadingButtonContent from "@/components/admin/LoadingButtonContent";
import modalStyles from "@/components/admin/AdminModal.module.css";
import { readJson, sendJson } from "@/components/admin/adminClientApi";
import Toast from "@/components/Toast";
import { useEffect, useState } from "react";

const ENDPOINT = "/api/admin/role-management/telegram";

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskTelegramUserId(value) {
  const id = String(value || "").trim();
  if (!id) return "Not configured";
  if (id.length <= 6) return id;
  return `${id.slice(0, 3)}•••${id.slice(-3)}`;
}

export default function TelegramRoleContactsCard() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(null);
  const [telegramUserId, setTelegramUserId] = useState("");
  const [pin, setPin] = useState("");
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadContacts() {
    try {
      setLoading(true);
      const result = await readJson(ENDPOINT);
      setContacts(result.contacts || []);
    } catch (error) {
      showToast(error.message || "Failed to load Telegram role contacts", "error");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(contact) {
    setEditing(contact);
    setTelegramUserId(contact.telegram_user_id || "");
    setPin("");
  }

  function closeEdit() {
    if (running) return;
    setEditing(null);
    setTelegramUserId("");
    setPin("");
  }

  async function save() {
    if (!editing || running || !pin) return;

    try {
      setRunning(true);
      await sendJson(ENDPOINT, "PATCH", {
        role: editing.role,
        telegram_user_id: telegramUserId.trim(),
        pin,
      });
      showToast("Telegram User ID updated");
      setEditing(null);
      setTelegramUserId("");
      setPin("");
      await loadContacts();
    } catch (error) {
      showToast(error.message || "Failed to update Telegram User ID", "error");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  return <>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    <section className="admin-status-card" style={styles.card}>
      <div style={styles.header}>
        <div>
          <div className="admin-status-label" style={styles.kicker}>Role Management</div>
          <h3 style={styles.title}>Telegram Role Contacts</h3>
          <div className="admin-status-meta">Assign one numeric Telegram User ID to each active role. Admin and Bendahara can review payment proofs.</div>
        </div>
        <button type="button" className="admin-small-btn" disabled={loading || running} onClick={loadContacts}>Refresh</button>
      </div>

      {loading && !contacts.length ? <AdminDataSkeleton showSummary={false} rows={5} /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table" style={styles.table}>
            <thead><tr><th className="admin-th">Role</th><th className="admin-th">Name</th><th className="admin-th">Telegram User ID</th><th className="admin-th">Role Status</th><th className="admin-th">Updated</th><th className="admin-th">Action</th></tr></thead>
            <tbody>{contacts.map((contact, index) => <tr key={contact.role} className={index % 2 ? "admin-row-alt" : ""}>
              <td className="admin-td">{contact.label}</td>
              <td className="admin-td">{contact.display_name || "-"}</td>
              <td className="admin-td">{maskTelegramUserId(contact.telegram_user_id)}</td>
              <td className="admin-td"><span className={`admin-deposit-status ${contact.active ? "admin-deposit-status-paid" : "admin-deposit-status-missed"}`}>{contact.active ? "Active" : "Inactive"}</span></td>
              <td className="admin-td">{formatTime(contact.updated_at)}</td>
              <td className="admin-td"><button type="button" className="admin-small-btn" disabled={running} onClick={() => openEdit(contact)}>Edit</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>

    {editing && <div className={modalStyles.overlay} onClick={closeEdit}>
      <div className={modalStyles.box} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalTitle}>Edit Telegram User ID — {editing.label}</div>
        <div style={styles.modalNote}>Use the numeric ID from Telegram, not the @username. Clearing the field removes Telegram action access for this role.</div>
        <label style={styles.label}><span>Telegram User ID</span><input className="admin-input" inputMode="numeric" value={telegramUserId} onChange={(event) => setTelegramUserId(event.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="123456789" /></label>
        <label style={styles.label}><span>Admin PIN</span><input className="admin-input" type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Enter admin PIN" /></label>
        <div style={styles.actions}><button type="button" className="admin-small-btn" disabled={running} onClick={closeEdit}>Cancel</button><button type="button" className="admin-small-btn" disabled={running || !pin} onClick={save}><LoadingButtonContent loading={running} loadingText="Saving...">Save</LoadingButtonContent></button></div>
      </div>
    </div>}
  </>;
}

const styles = {
  card: { marginTop: 14, marginBottom: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  kicker: { textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, marginBottom: 5 },
  title: { margin: 0, fontSize: 18, color: "var(--admin-text)" },
  table: { minWidth: 820 },
  modalTitle: { fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginBottom: 10 },
  modalNote: { paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--admin-border)", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.6 },
  label: { display: "grid", gap: 6, color: "var(--admin-muted)", fontSize: 13, fontWeight: 700, marginBottom: 12 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
};
