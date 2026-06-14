"use client";

import { useEffect, useMemo, useState } from "react";
import AdminActionButton from "@/components/admin/AdminActionButton";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import modalStyles from "@/components/admin/AdminModal.module.css";
import Toast from "@/components/Toast";
import { sendJson } from "@/components/admin/adminClientApi";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";
import styles from "@/app/admin/profile/profile.module.css";

const EMPTY_MODAL = { type: "", step: 1, value: "", confirmation: "" };

function timeAgo(date, now) {
  if (!date) return "-";
  const diff = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));

  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function getRemainingSessionTime(expiresAt, now) {
  if (!expiresAt) return "Waktu berakhir tidak tersedia";

  const expiresTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresTime)) return "Waktu berakhir tidak tersedia";

  const diff = Math.max(0, Math.floor((expiresTime - now) / 1000));
  if (diff <= 0) return "Sesi telah berakhir";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `Berakhir dalam ${days} hari ${hours} jam`;
  if (hours > 0) return `Berakhir dalam ${hours} jam ${minutes} menit`;
  if (minutes > 0) return `Berakhir dalam ${minutes} menit`;
  return "Berakhir dalam kurang dari 1 menit";
}

function getCredentialStatus(credential, now) {
  if (!credential?.active) return "Belum aktif";
  if (!credential.updated_at) return "Aktif · belum pernah diperbarui";
  return `Aktif · diperbarui ${timeAgo(credential.updated_at, now)}`;
}

function getDeviceLocation(session) {
  const parts = [session?.device_name, session?.location].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Perangkat tidak dikenal";
}

function getActivityTitle(activity) {
  if (activity?.type === "login") return "Login berhasil";
  if (activity?.type === "security-update") {
    return `${activity.credential_type === "pin" ? "PIN" : "Password"} diperbarui`;
  }
  if (activity?.type === "revoke") return "Sesi perangkat dicabut";
  return activity?.message || "Aktivitas keamanan";
}

function SkeletonBlock({ width = "100%", height = 12, radius = 999 }) {
  return (
    <span
      aria-hidden="true"
      className="profile-skeleton-block"
      style={{ width, height, borderRadius: radius }}
    />
  );
}

function ProfileSkeleton() {
  return (
    <main className={styles.page}>
      <style>{`
        @keyframes profile-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .profile-skeleton-block {
          display: block;
          flex: 0 0 auto;
          background: linear-gradient(
            90deg,
            var(--admin-row) 25%,
            color-mix(in srgb, var(--admin-muted) 18%, var(--admin-row)) 50%,
            var(--admin-row) 75%
          );
          background-size: 200% 100%;
          animation: profile-skeleton-shimmer 1.35s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .profile-skeleton-block { animation: none; }
        }
      `}</style>
      <div className={styles.container}>
        <section className={styles.card} aria-busy="true" aria-label="Memuat profile">
          <header className={styles.identity}>
            <SkeletonBlock width={54} height={54} radius={18} />
            <div style={{ display: "grid", gap: 8, width: "min(100%, 230px)" }}>
              <SkeletonBlock width="34%" height={10} />
              <SkeletonBlock width="72%" height={22} radius={8} />
              <SkeletonBlock width="54%" height={12} />
            </div>
          </header>

          <div className={styles.section}>
            <SkeletonBlock width={110} height={10} />
            {[0, 1].map((item) => (
              <div key={item} className={styles.row}>
                <div style={{ display: "grid", gap: 8, width: "min(70%, 280px)" }}>
                  <SkeletonBlock width={item === 0 ? "42%" : "28%"} height={15} radius={6} />
                  <SkeletonBlock width="76%" height={11} />
                </div>
                <SkeletonBlock width={58} height={34} radius={10} />
              </div>
            ))}
          </div>

          <div className={styles.section}>
            <SkeletonBlock width={90} height={10} />
            <div className={styles.currentSession} style={{ display: "grid", gap: 9, marginTop: 10 }}>
              <SkeletonBlock width="64%" height={14} radius={6} />
              <SkeletonBlock width="46%" height={11} />
              <SkeletonBlock width="38%" height={11} />
            </div>
          </div>

          <div className={styles.section}>
            <SkeletonBlock width={132} height={10} />
            <div className={styles.activityList} style={{ marginTop: 10 }}>
              {[0, 1].map((item) => (
                <div key={item} className={styles.activityItem}>
                  <div style={{ display: "grid", gap: 7, width: "min(68%, 260px)" }}>
                    <SkeletonBlock width="58%" height={13} radius={6} />
                    <SkeletonBlock width="86%" height={10} />
                  </div>
                  <SkeletonBlock width={62} height={10} />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.accountSection}>
            <SkeletonBlock width={128} height={10} />
            <div className={styles.manageRow}>
              <div style={{ display: "grid", gap: 8, width: "min(70%, 280px)" }}>
                <SkeletonBlock width="52%" height={15} radius={6} />
                <SkeletonBlock width="84%" height={11} />
              </div>
              <SkeletonBlock width={66} height={34} radius={10} />
            </div>
            <SkeletonBlock width="100%" height={42} radius={12} />
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AdminProfilePageClient() {
  const [profile, setProfile] = useState(null);
  const [sessionNow, setSessionNow] = useState(() => Date.now());
  const [sessionLoading, setSessionLoading] = useState(true);
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [credentialSuccess, setCredentialSuccess] = useState("");
  const [manageSessionsOpen, setManageSessionsOpen] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState(null);

  async function loadProfile({ signal, showLoading = true } = {}) {
    if (showLoading) setSessionLoading(true);

    try {
      const res = await fetch(`/api/admin/profile/overview?_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });

      if (res.status === 401) {
        window.location.replace("/login");
        return null;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat profile");

      setProfile(data);
      setSessionNow(Date.now());
      return data;
    } finally {
      if (!signal?.aborted) setSessionLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    async function refresh() {
      controller.abort();
      controller = new AbortController();
      try {
        await loadProfile({ signal: controller.signal, showLoading: !profile });
      } catch (error) {
        if (error.name !== "AbortError" && active) {
          setToast({ message: error.message || "Gagal memuat profile", type: "error" });
        }
      }
    }

    const pageShow = () => refresh();
    const visibility = () => document.visibilityState === "visible" && refresh();
    refresh();
    window.addEventListener("pageshow", pageShow);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("pageshow", pageShow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!profile?.current_session?.expires_at) return undefined;
    const timer = window.setInterval(() => setSessionNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [profile?.current_session?.expires_at]);

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

  async function revokeSession(session) {
    if (!session?.id || session.current || revokingSessionId) return;
    setRevokingSessionId(session.id);

    try {
      const data = await sendJson("/api/admin/profile/sessions", "DELETE", { id: session.id });
      showToast(data.message || "Sesi berhasil dicabut");
      await loadProfile({ showLoading: false });
    } catch (error) {
      showToast(error.message || "Gagal mencabut sesi", "error");
    } finally {
      setRevokingSessionId("");
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
  const role = profile?.role;
  const currentSession = profile?.current_session;

  if (sessionLoading && !profile) {
    return <ProfileSkeleton />;
  }

  if (!profile || !role) return null;

  return <main className={styles.page}>
    <Toast show={!!toast} type={toast?.type} message={toast?.message} />
    <div className={styles.container}><section className={styles.card}>
      <header className={styles.identity}>
        <div className={styles.avatar}>{getAdminAccessRoleInitials(role)}</div>
        <div><p className={styles.eyebrow}>Profile</p><h1>{getAdminAccessRoleLabel(role)}</h1><span>Akun pengurus Blok E</span></div>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Keamanan Akun</div>
        <div className={styles.row}>
          <div><strong>Password</strong><span>{getCredentialStatus(profile.credentials?.password, sessionNow)}</span></div>
          <button type="button" onClick={() => setModal({ type: "password", step: 1, value: "", confirmation: "" })}>Ubah</button>
        </div>
        <div className={styles.row}>
          <div><strong>PIN</strong><span>{getCredentialStatus(profile.credentials?.pin, sessionNow)}</span></div>
          <button type="button" onClick={() => setModal({ type: "pin", step: 1, value: "", confirmation: "" })}>Ubah</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Sesi Saat Ini</div>
        <div className={styles.currentSession}>
          <strong>{getDeviceLocation(currentSession)}</strong>
          <span>Terakhir aktif {timeAgo(currentSession?.last_active, sessionNow)}</span>
          <span className={styles.expiry}>{getRemainingSessionTime(currentSession?.expires_at, sessionNow)}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Aktivitas Keamanan</div>
        <div className={styles.activityList}>
          {profile.activities?.length ? profile.activities.map((activity) => (
            <div key={activity.id} className={styles.activityItem}>
              <div>
                <strong>{getActivityTitle(activity)}</strong>
                <span>{getDeviceLocation(activity)}</span>
              </div>
              <time>{timeAgo(activity.created_at, sessionNow)}</time>
            </div>
          )) : <div className={styles.emptyState}>Belum ada aktivitas keamanan.</div>}
        </div>
      </div>

      <div className={styles.accountSection}>
        <div className={styles.sectionTitle}>Perangkat yang Login</div>
        <div className={styles.manageRow}>
          <div><strong>{profile.session_count} sesi aktif</strong><span>Perangkat dengan akses {getAdminAccessRoleLabel(role)}</span></div>
          <button type="button" onClick={() => setManageSessionsOpen(true)}>Kelola</button>
        </div>
        <AdminActionButton className={styles.logout} loading={loggingOut} loadingText="Sedang keluar..." onClick={logout}>Keluar dari Akun</AdminActionButton>
      </div>
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

    {manageSessionsOpen && (
      <div className={modalStyles.overlay} onClick={() => !revokingSessionId && setManageSessionsOpen(false)}>
        <div className={`${modalStyles.box} ${styles.sessionModal}`} onClick={(event) => event.stopPropagation()}>
          <h2>Perangkat yang Login</h2>
          <p>Hanya sesi aktif untuk akun {getAdminAccessRoleLabel(role)}.</p>
          <div className={styles.sessionList}>
            {profile.sessions.map((session) => (
              <div key={session.id} className={styles.sessionItem}>
                <div>
                  <strong>{session.device_name}</strong>
                  <span>{session.location || "Lokasi tidak tersedia"}</span>
                  <small>Terakhir aktif {timeAgo(session.last_active, sessionNow)}</small>
                </div>
                {session.current ? (
                  <span className={styles.currentBadge}>Perangkat ini</span>
                ) : (
                  <button type="button" className={styles.revokeButton} disabled={!!revokingSessionId} onClick={() => revokeSession(session)}>
                    {revokingSessionId === session.id ? "Mencabut..." : "Cabut"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className={styles.closeModalButton} disabled={!!revokingSessionId} onClick={() => setManageSessionsOpen(false)}>Tutup</button>
        </div>
      </div>
    )}

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
