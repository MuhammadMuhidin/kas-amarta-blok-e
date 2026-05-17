"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import Toast from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

export default function Login() {
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [needPin, setNeedPin] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [toast, setToast] =
    useState({
      show: false,
      type: "info",
      message: "",
    });

  function notify(
    message,
    type = "info"
  ) {
    setToast({
      show: true,
      type,
      message,
    });

    setTimeout(() => {
      setToast((prev) => ({
        ...prev,
        show: false,
      }));
    }, 2600);
  }

  async function submit(e) {
    e.preventDefault();

    if (loading) return;

    if (!password.trim()) {
      notify(
        "Password wajib diisi",
        "warning"
      );
      return;
    }

    if (
      needPin &&
      !pin.trim()
    ) {
      notify(
        "PIN wajib diisi",
        "warning"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            password,
            pin: needPin
              ? pin
              : undefined,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        notify(
          data.error ||
            "Login gagal",
          "error"
        );
        return;
      }

      if (data.need_webauth) {
        notify(
          "Verifikasi passkey diperlukan",
          "info"
        );

        await loginWithWebAuth();
        return;
      }

if (data.need_pin) {
  setNeedPin(true);

  notify(
    "Masukkan PIN admin",
    "info"
  );

  return;
}

if (data.need_webauth) {
  notify(
    "Verifikasi passkey diperlukan",
    "info"
  );

  await loginWithWebAuth();

  return;
}

      notify(
        "Login berhasil",
        "success"
      );

      router.push("/admin");
    } catch (err) {
      notify(
        err.message ||
          "Login gagal",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loginWithWebAuth() {
    try {
      const optionsRes =
        await fetch(
          "/api/webauth/auth/options"
        );

      const options =
        await optionsRes.json();

      if (!optionsRes.ok) {
        notify(
          options.error ||
            "Passkey belum siap",
          "error"
        );
        return;
      }

      const credential =
        await startAuthentication(
          options
        );

      const verifyRes =
        await fetch(
          "/api/webauth/auth/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              credential
            ),
          }
        );

      const verifyData =
        await verifyRes.json();

      if (!verifyRes.ok) {
        notify(
          verifyData.error ||
            "Verifikasi passkey gagal",
          "error"
        );
        return;
      }

      notify(
        "Passkey valid, masuk admin",
        "success"
      );

      router.push("/admin");
    } catch (err) {
      notify(
        err.message ||
          "Passkey dibatalkan",
        "error"
      );
    }
  }

  function registerWebAuth() {
    if (loading) return;

    setConfirmOpen(true);
  }

  async function handleConfirmRegister() {
    setConfirmOpen(false);
    setLoading(true);

    try {
      notify(
        "Menyiapkan register passkey",
        "info"
      );

      const optionsRes =
        await fetch(
          "/api/webauth/register/options"
        );

      const options =
        await optionsRes.json();

      if (!optionsRes.ok) {
        notify(
          options.error ||
            "Gagal membuat register options",
          "error"
        );
        return;
      }

      const credential =
        await startRegistration(
          options
        );

      const verifyRes =
        await fetch(
          "/api/webauth/register/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              credential
            ),
          }
        );

      const verifyData =
        await verifyRes.json();

      if (!verifyRes.ok) {
        notify(
          verifyData.error ||
            "Register passkey gagal",
          "error"
        );
        return;
      }

      notify(
        "Passkey berhasil didaftarkan",
        "success"
      );
    } catch (err) {
      notify(
        err.message ||
          "Register passkey dibatalkan",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toast {...toast} />

      <ConfirmModal
        open={confirmOpen}
        title="Daftarkan passkey baru?"
        message="Credential lama akan dinonaktifkan dan diganti dengan passkey baru."
        confirmText="Daftarkan"
        cancelText="Batal"
        onCancel={() =>
          setConfirmOpen(false)
        }
        onConfirm={
          handleConfirmRegister
        }
      />

      <div style={styles.wrapper}>
        <form
          onSubmit={submit}
          style={styles.card}
        >
          <div style={styles.badge}>
            Admin Security
          </div>

          <h2 style={styles.title}>
            Admin Login
          </h2>

          <p style={styles.subtitle}>
            Masuk dengan password,
            lalu PIN atau passkey jika aktif.
          </p>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            style={styles.input}
          />

          {needPin && (
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN Admin"
              value={pin}
              onChange={(e) =>
                setPin(
                  e.target.value
                )
              }
              style={styles.input}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading
                ? 0.75
                : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Memproses..."
              : needPin
                ? "Verifikasi PIN"
                : "Login"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={registerWebAuth}
            style={{
              ...styles.secondaryButton,
              opacity: loading
                ? 0.75
                : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            Register Passkey
          </button>
        </form>
      </div>
    </>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background:
      "linear-gradient(135deg, #e0e7ff, #f8fafc)",
    fontFamily: "system-ui",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 360,
    padding: 28,
    background: "#ffffff",
    borderRadius: 22,
    boxShadow:
      "0 24px 70px rgba(15,23,42,.18)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    border:
      "1px solid rgba(226,232,240,.9)",
  },

  badge: {
    alignSelf: "center",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 800,
  },

  title: {
    textAlign: "center",
    margin: "4px 0 0",
    fontSize: 24,
    color: "#0f172a",
  },

  subtitle: {
    textAlign: "center",
    margin: "0 0 10px",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },

  input: {
    padding: "13px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
  },

  button: {
    padding: 13,
    borderRadius: 12,
    border: "none",
    background:
      "linear-gradient(135deg, #4f46e5, #2563eb)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
  },

  secondaryButton: {
    padding: 13,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    fontWeight: 800,
    fontSize: 14,
  },
};
