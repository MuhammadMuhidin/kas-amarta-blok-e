"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import styles from "./profile.module.css";

const EMPTY_MODAL = { type: "", step: 1, value: "", confirmation: "" };

export default function AdminProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch("/api/admin/sessions/check", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Session tidak valid");
        return res.json();
      })
      .then((data) => setRole(data.access_role || "admin"))
      .catch(() => router.replace("/login"));
  }, [router]);

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

  function openModal(type) {
    setModal({ type, step: 1, value: "", confirmation: "" });
  }

  function closeModal() {
    if (!saving) setModal(EMPTY_MODAL);
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
      window.location.replace("/login");
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
      router.replace("/login");
      router.refresh();
    } catch (error) {
      showToast(error.message || "Gagal keluar dari akun", "error");
      setLoggingOut(false);
    }
  }

  const isPassword = modal.type === "password";
  const modalTitle = `${modal.step === 1 ? "Ubah" : "Konfirmasi"} ${isPassword ? "Password" : "PIN"}`;

  return (
    <main className={styles.page}>
      <Toast show={!!toast} type={toast?.type} message={toast?.message} />
      <div className={styles.container}>
        <section className={styles.card}>
          <header className={styles.identity}>
            <div className={styles.avatar}>{getAdminAccessRoleInitials(role)}</div>
            <div>
              <p className={styles.eyebrow}>Profile</p>
              <h1>{getAdminAccessRoleLabel(role)}</h1>
              <span>Akun pengurus Blok E</span>
            </div>
          </header>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Keamanan Akun</div>
            <div className={styles.row}>
              <div><strong>Password</strong><span>Minimal 8 karakter, huruf dan angka</span></div>
              <button type="button" onClick={() => openModal("password")}>Ubah</button>
            </div>
            <div className={styles.row}>
              <div><strong>PIN</strong><span>4 digit angka</span></div>
              <button type="button" onClick={() => openModal("pin")}>Ubah</button>
            </div>
          </div>

          <div className={styles.accountSection}>
            <div className={styles.sectionTitle}>Akun</div>
            <AdminActionButton
              className={styles.logout}
              loading={loggingOut}
              loadingText="Sedang keluar..."
              onClick={logout}
            >
              Keluar dari Akun
            </AdminActionButton>
          </div>
        </section>
      </div>

      <AdminConfirmModal
        open={!!modal.type}
        title={modalTitle}
        description={modal.step === 1
          ? `Masukkan ${isPassword ? "password" : "PIN"} baru.`
          : `Masukkan ulang ${isPassword ? "password" : "PIN"} baru untuk memastikan nilainya sama.`}
        cancelText="Batal"
        confirmText={modal.step === 1 ? "Lanjutkan" : "Simpan"}
        confirmDisabled={modal.step === 1 ? !firstStepValid : !confirmValid}
        loading={saving}
        loadingText="Menyimpan..."
        onCancel={closeModal}
        onConfirm={() => modal.step === 1
          ? firstStepValid && setModal((current) => ({ ...current, step: 2, confirmation: "" }))
          : submitCredential()}
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
              setModal((current) => ({
                ...current,
                [current.step === 1 ? "value" : "confirmation"]: value,
              }));
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
    </main>
  );
}
