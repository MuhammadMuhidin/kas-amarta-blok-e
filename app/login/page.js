"use client";

import {
  useState,
  useEffect,
} from "react";

import { useRouter } from "next/navigation";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import Toast from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

export default function Login() {
  const router = useRouter();

  const [isDark, setIsDark] =
    useState(false);

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

  useEffect(() => {
    const media =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

    function updateTheme() {
      setIsDark(
        media.matches
      );
    }

    updateTheme();

    media.addEventListener(
      "change",
      updateTheme
    );

    return () => {
      media.removeEventListener(
        "change",
        updateTheme
      );
    };
  }, []);

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

          body:
            JSON.stringify({
              password,

              pin:
                needPin
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

      router.push(
        "/admin"
      );
    } catch (err) {
      notify(
        err.message ||
          "Login gagal",
        "error"
      );
    } finally {
      setLoading(
        false
      );
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
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
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
        "Passkey valid",
        "success"
      );

      router.push(
        "/admin"
      );
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

    setConfirmOpen(
      true
    );
  }

  async function handleConfirmRegister() {
    setConfirmOpen(
      false
    );

    setLoading(
      true
    );

    try {
      notify(
        "Menyiapkan passkey",
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
            "Gagal menyiapkan passkey",
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
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
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
          "Register dibatalkan",
        "error"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <>
      <style jsx global>{`
@keyframes securityPulse {
  0%,100%{
    opacity:.9;
    transform:scale(.995);
    filter:drop-shadow(0 0 0 rgba(250,204,21,0));
  }

  50%{
    opacity:1;
    transform:scale(1);
    filter:drop-shadow(0 0 6px rgba(250,204,21,.28));
  }
}
      `}</style>

      <Toast
        {...toast}
      />

      <ConfirmModal
        open={confirmOpen}
        isDark={isDark}
        title="Daftarkan passkey baru?"
        message="Credential lama akan diganti."
        confirmText="Daftarkan"
        cancelText="Batal"
        onCancel={() =>
          setConfirmOpen(
            false
          )
        }
        onConfirm={
          handleConfirmRegister
        }
      />

      <div
        style={{
          ...styles.wrapper,

          background:
            isDark
              ? "linear-gradient(135deg,#020617,#0f172a)"
              : "linear-gradient(135deg,#e0e7ff,#f8fafc)",
        }}
      >
        <form
          onSubmit={submit}
          style={{
            ...styles.card,

            background:
              isDark
                ? "#111827"
                : "#ffffff",

            border:
              isDark
                ? "1px solid #334155"
                : "1px solid rgba(226,232,240,.9)",
          }}
        >
          <div
            style={{
              ...styles.badge,

              background:
                isDark
                  ? "rgba(15,23,42,.92)"
                  : "rgba(255,255,255,.92)",

              color:
                "#facc15",

              border: `1px solid ${
                isDark
                  ? "#334155"
                  : "#cbd5e1"
              }`,

              boxShadow:
                isDark
                  ? "0 0 16px rgba(250,204,21,.14)"
                  : "0 4px 18px rgba(250,204,21,.10)",
            }}
          >
            Admin Management Access
          </div>

          <h2
            style={{
              ...styles.title,

              color:
                isDark
                  ? "#f8fafc"
                  : "#0f172a",
            }}
          >
            Administrator Login
          </h2>

          <p
            style={{
              ...styles.subtitle,

              color:
                isDark
                  ? "#94a3b8"
                  : "#64748b",
            }}
          >
            Password, PIN, Passkey
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
            style={{
              ...styles.input,

              background:
                isDark
                  ? "#1e293b"
                  : "#fff",

              color:
                isDark
                  ? "#fff"
                  : "#000",

              border:
                isDark
                  ? "1px solid #334155"
                  : "1px solid #cbd5e1",
            }}
          />

          {needPin && (
            <input
              type="password"
              placeholder="PIN Admin"
              value={pin}
              onChange={(e) =>
                setPin(
                  e.target.value
                )
              }
              style={{
                ...styles.input,

                background:
                  isDark
                    ? "#1e293b"
                    : "#fff",

                color:
                  isDark
                    ? "#fff"
                    : "#000",

                border:
                  isDark
                    ? "1px solid #334155"
                    : "1px solid #cbd5e1",
              }}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,

              opacity:
                loading
                  ? 0.75
                  : 1,
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

              color:
                isDark
                  ? "#fff"
                  : "#0f172a",

              border:
                isDark
                  ? "1px solid #334155"
                  : "1px solid #cbd5e1",

              background:
                isDark
                  ? "#1e293b"
                  : "transparent",

              opacity:
                loading
                  ? 0.75
                  : 1,
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
    position: "fixed",
    inset: 0,

    width: "100vw",
    height: "100dvh",

    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    padding: 20,
    boxSizing: "border-box",

    overflow: "hidden",

    fontFamily: "system-ui",
  },

  card: {
    width: "100%",
    maxWidth: 360,

    maxHeight:
      "calc(100dvh - 40px)",

    overflow: "hidden",

    padding: 28,
    boxSizing: "border-box",

    borderRadius: 22,
    boxShadow:
      "0 24px 70px rgba(15,23,42,.18)",

    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  badge: {
    alignSelf: "center",

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    padding: "9px 16px",

    borderRadius: 999,

    fontSize: 12.5,
    fontWeight: 800,

    letterSpacing: ".14em",
    textTransform: "uppercase",

    textShadow:
      "0 0 8px rgba(250,204,21,.25)",

    animation:
      "securityPulse 3.6s ease-in-out infinite",
  },

  title: {
    textAlign: "center",
    margin: "4px 0 0",
    fontSize: 24,
  },

  subtitle: {
    textAlign: "center",
    margin: 0,
    fontSize: 13,
  },

  input: {
    padding: "13px 14px",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
  },

  button: {
    padding: 13,
    border: "none",
    borderRadius: 12,

    background:
      "linear-gradient(135deg,#4f46e5,#2563eb)",

    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    padding: 13,
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};
