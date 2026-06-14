"use client";

import { useEffect, useMemo, useState } from "react";
import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import styles from "@/app/admin/profile/profile.module.css";

const EMPTY_MODAL = { type: "", step: 1, value: "", confirmation: "" };

export default function AdminProfilePageClient() {
  const [role, setRole] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [credentialSuccess, setCredentialSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    async function loadSession() {
      controller.abort();
      controller = new AbortController();
      if (active) {
        setSessionLoading(true);
        setRole(null);
      }

      try {
        const res = await fetch(`/api/admin/sessions/check?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Session tidak valid");
        const data = await res.json();
        if (active) setRole(data.access_role || "admin");
      } catch (error) {
        if (error.name !== "AbortError" && active) window.location.replace("/login");
      } finally {
        if (active && !controller.signal.aborted) setSessionLoading(false);
      }
    }

    const pageShow = () => loadSession();
    const visibility = () => document.visibilityState === "visible" && loadSession();
    loadSession();
    window.addEventListener("pageshow", pageShow);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("pageshow", pageShow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const passwordValid = useMemo(() => (
    modal.value.length >= 8 && modal.value.length <= 128 &&
    /[A-Za-z]/.test(modal.value) && /\d/.test(modal.value)
  ), [modal.value]);
  const pinValid = /^\d{4}$/.test(modal.value);
  const firstStepValid = modal.type === "password" ? passwordValid : pinValid;
  const confirmValid = modal.confirmation === modal.value && modal.confirmation.length > 0;

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2500);
  }

  async function submitCredential() {
    if (!confirmValid || saving) return;
    setSaving(true);
    try {
      const isPassword = modal.type === "password";
      await sendJson(
        isPassword ? "/api/admin/profile/password" : "/api/admin/profile/pin",
        "PATCH",
        isPassword
          ? { new_password: modal.value, confirmation: modal.confirmation }
          : { new_pin: modal.value, confirmation: modal.confirmation },
      );
      setModal(EMPTY_MODAL);
      setCredentialSuccess(isPassword ? "Password" : "PIN");
    } catch (error) {
      setModal(EMPTY_MODAL);
      showToast(error.message || "Gagal memperbarui credential", "error");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await sendJson("/api/logout", "POST", {});
      window.location.replace("/login");
    } catch (error) {
      showToast(error.message || "Gagal keluar dari akun", "error");
      setLoggingOut(false);
    }
  }

  const isPassword = modal.type === "password";
  const modalTitle = `${modal.step === 1 ? "Ubah" : "Konfirmasi"} ${isPassword ? "Password" : "PIN"}`;

  if (sessionLoading || !role) {
    return <main className={styles.page}><div className={styles.container}><section className={styles.card} aria-busy="true"><header className={styles.identity}><div className={styles.avatar}>…</div><div><p className={styles.eyebrow}>Profile</p><h1>Memuat profile…</h1><span>Memverifikasi sesi akun</span></div></header></section></div></main>;
  }

  return <main className={styles.page}>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    <div className={styles.container}><section className={styles.card}>
      <header className={styles.identity}><div className={styles.avatar}>{getAdminAccessRoleInitials(role)}</div><div><p className={styles.eyebrow}>Profile</p><h1>{getAdminAccessRoleLabel(role)}</h1><span>Akun pengurus Blok E</span></div></header>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Keamanan Akun</div>
        <div className={styles.row}><div><strong>Password</strong><span>Minimal 8 karakter, huruf dan angka</span></div><button type="button" onClick={() => setModal({ type: "password", step: 1, value: "", confirmation: "" })}>Ubah</button></div>
        <div className={styles.row}><div><strong>PIN</strong><span>4 digit angka</span></div><button type="button" onClick={() => setModal({ type: "pin", step: 1, value: "", confirmation: "" })}>Ubah</button></div>
      </div>
      <div className={styles.accountSection}><div className={styles.sectionTitle}>Akun</div><AdminActionButton className={styles.logout} loading={loggingOut} loadingText="Sedang keluar..." onClick={logout}>Keluar dari Akun</AdminActionButton></div>
    </section></div>

    <AdminConfirmModal
      open={!!modal.type}
      title={modalTitle}
      description={modal.step === 1 ? `Masukkan ${isPassword ? "password" : "PIN"} baru.` : `Masukkan ulang ${isPassword ? "password" : "PIN"} baru untuk memastikan nilainya sama.`}
      cancelText="Batal"
      confirmText={modal.step === 1 ? "Lanjutkan" : "Simpan"}
      confirmDisabled={modal.step === 1 ? !firstStepValid : !confirmValid}
      loading={saving}
      loadingText="Menyimpan..."
      onCancel={() => !saving && setModal(EMPTY_MODAL)}
      onConfirm={() => modal.step === 1 ? firstStepValid && setModal((current) => ({ ...current, step: 2, confirmation: "" })) : submitCredential()}
    >
      <label className={styles.modalField}>
        <span>{modal.step === 1 ? (isPassword ? "Password baru" : "PIN baru") : `Ulangi ${isPassword ? "password" : "PIN"}`}</span>
        <input
          autoFocus
          type="password"
          inputMode={isPassword ? "text" : "numeric"}
          minLength={isPassword ? 8 : 4}
          maxLength={isPassword ? 128 : 4}
          autoComplete="new-password"
          value={modal.step === 1 ? modal.value : modal.confirmation}
          onChange={(event) => {
            const raw = event.target.value;
            const value = isPassword ? raw.slice(0, 128) : raw.replace(/\D/g, "").slice(0, 4);
            setModal((current) => ({ ...current, [current.step === 1 ? "value" : "confirmation"]: value }));
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (modal.step === 1 && firstStepValid) setModal((current) => ({ ...current, step: 2, confirmation: "" }));
            if (modal.step === 2 && confirmValid) submitCredential();
          }}
        />
        <small>{modal.step === 2 && modal.confirmation && !confirmValid ? "Nilai belum sama." : isPassword ? "8–128 karakter, wajib mengandung huruf dan angka." : "Tepat 4 digit angka."}</small>
      </label>
    </AdminConfirmModal>

    <AdminConfirmModal
      open={!!credentialSuccess}
      title={`${credentialSuccess} berhasil diperbarui`}
      description={`Demi keamanan, seluruh sesi akun ini telah dikeluarkan. Silakan login kembali menggunakan ${credentialSuccess.toLowerCase()} baru.`}
      hideCancel
      confirmText="Login Kembali"
      onCancel={() => {}}
      onConfirm={() => window.location.replace("/login")}
    />
  </main>;
}
