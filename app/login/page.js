"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

export default function Login() {
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function submit(e) {
    e.preventDefault();

    if (loading) return;

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
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(
          data.error ||
          "Login gagal"
        );
        return;
      }

      if (data.need_webauth) {
        await loginWithWebAuth();
        return;
      }

      router.push("/admin");
    } catch (err) {
      alert(
        err.message ||
        "Login gagal"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loginWithWebAuth() {
    const optionsRes =
      await fetch(
        "/api/webauth/auth/options",
        {
          method: "GET",
        }
      );

    const options =
      await optionsRes.json();

    if (!optionsRes.ok) {
      alert(
        options.error ||
        "WebAuth belum siap"
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
      alert(
        verifyData.error ||
        "WebAuth gagal"
      );
      return;
    }

    router.push("/admin");
  }

  async function registerWebAuth() {
    if (loading) return;

    const confirmRegister =
      confirm(
        "Daftarkan fingerprint/passkey baru? Credential lama akan diganti."
      );

    if (!confirmRegister) return;

    setLoading(true);

    try {
      const optionsRes =
        await fetch(
          "/api/webauth/register/options",
          {
            method: "GET",
          }
        );

      const options =
        await optionsRes.json();

      if (!optionsRes.ok) {
        alert(
          options.error ||
          "Gagal membuat register options"
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
        alert(
          verifyData.error ||
          "Register WebAuth gagal"
        );
        return;
      }

      alert(
        "WebAuth berhasil didaftarkan"
      );
    } catch (err) {
      alert(
        err.message ||
        "Register WebAuth gagal"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        html {
          background: #f1f5f9;
        }

        @media (prefers-color-scheme: dark) {
          html {
            filter: invert(1)
              hue-rotate(180deg);
          }
        }
      `}</style>

      <div style={styles.wrapper}>
        <form
          onSubmit={submit}
          style={styles.card}
        >
          <h2 style={styles.title}>
            Admin Login
          </h2>

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

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading
                ? 0.7
                : 1,
            }}
          >
            {loading
              ? "Memproses..."
              : "Login"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={registerWebAuth}
            style={styles.secondaryButton}
          >
            Register WebAuth
          </button>
        </form>
      </div>
    </>
  );
}

const styles = {
  wrapper: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#e5e7eb",
    fontFamily: "system-ui",
  },

  card: {
    width: 320,
    padding: 30,
    background: "#fff",
    borderRadius: 12,
    boxShadow:
      "0 10px 25px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 15,
  },

  title: {
    textAlign: "center",
    marginBottom: 10,
  },

  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
  },

  button: {
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },

  secondaryButton: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
