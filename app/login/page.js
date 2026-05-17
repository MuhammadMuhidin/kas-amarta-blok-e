Berikut full code final app/login/page.js dengan:

✓ Auto dark mode (ikut system)
✓ Password
✓ Optional PIN
✓ Optional Passkey
✓ Toast
✓ Confirm modal
✓ Tidak pakai invert hack
✓ Theme change realtime

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

    if (loading) {
      return;
    }

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

      /*
        PIN
      */

      if (data.need_pin) {
        setNeedPin(true);

        notify(
          "Masukkan PIN admin",
          "info"
        );

        return;
      }

      /*
        WEBAUTH
      */

      if (
        data.need_webauth
      ) {
        notify(
          "Verifikasi passkey diperlukan",
          "info"
        );

        await loginWithWebAuth();

        return;
      }

      /*
        SUCCESS
      */

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

      if (
        !optionsRes.ok
      ) {
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

      if (
        !verifyRes.ok
      ) {
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
    if (loading) {
      return;
    }

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

      if (
        !optionsRes.ok
      ) {
        notify(
          options.error,
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

      if (
        !verifyRes.ok
      ) {
        notify(
          verifyData.error,
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
      <Toast
        {...toast}
      />

      <ConfirmModal
        open={
          confirmOpen
        }
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
          onSubmit={
            submit
          }
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
            style={
              styles.badge
            }
          >
            Admin Security
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
            Admin Login
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
            Password,
            PIN,
            Passkey
          </p>

          <input
            type="password"
            placeholder="Password"
            value={
              password
            }
            onChange={(
              e
            ) =>
              setPassword(
                e.target
                  .value
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
              value={
                pin
              }
              onChange={(
                e
              ) =>
                setPin(
                  e
                    .target
                    .value
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
            disabled={
              loading
            }
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
            disabled={
              loading
            }
            onClick={
              registerWebAuth
            }
            style={
              styles.secondaryButton
            }
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
    minHeight:
      "100vh",

    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    padding:
      20,

    fontFamily:
      "system-ui",
  },

  card: {
    width:
      "100%",

    maxWidth:
      360,

    padding:
      28,

    borderRadius:
      22,

    boxShadow:
      "0 24px 70px rgba(15,23,42,.18)",

    display:
      "flex",

    flexDirection:
      "column",

    gap:
      14,
  },

  badge: {
    alignSelf:
      "center",

    padding:
      "6px 12px",

    borderRadius:
      999,

    background:
      "#eef2ff",

    color:
      "#4f46e5",

    fontSize:
      12,

    fontWeight:
      800,
  },

  title: {
    textAlign:
      "center",

    margin:
      "4px 0 0",

    fontSize:
      24,
  },

  subtitle: {
    textAlign:
      "center",

    margin:
      0,

    fontSize:
      13,
  },

  input: {
    padding:
      "13px 14px",

    borderRadius:
      12,

    fontSize:
      14,

    outline:
      "none",
  },

  button: {
    padding:
      13,

    border:
      "none",

    borderRadius:
      12,

    background:
      "linear-gradient(135deg,#4f46e5,#2563eb)",

    color:
      "#fff",

    fontWeight:
      800,

    cursor:
      "pointer",
  },

  secondaryButton:
    {
      padding:
        13,

      borderRadius:
        12,

      border:
        "1px solid #cbd5e1",

      background:
        "transparent",

      fontWeight:
        800,

      cursor:
        "pointer",
    },
};
