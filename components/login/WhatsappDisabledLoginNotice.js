"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

const REQUEST_OTP_PATH = "/api/admin/auth/request-otp";
const LOGIN_PATH = "/api/login";
const BODY_CLASS = "login-whatsapp-disabled-active";

function getRequestPath(input) {
  try {
    const rawUrl = typeof input === "string" ? input : input?.url;
    return new URL(rawUrl, window.location.origin).pathname;
  } catch {
    return "";
  }
}

export default function WhatsappDisabledLoginNotice() {
  const [open, setOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const disabledFlowRef = useRef(false);
  const gateResolverRef = useRef(null);
  const okRequestedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setIsDark(media.matches);
    updateTheme();
    media.addEventListener("change", updateTheme);

    return () => media.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    const previousFetch = window.fetch;
    const originalFetch = previousFetch.bind(window);

    function closeNotice() {
      document.body.classList.remove(BODY_CLASS);
      setOpen(false);
      setContinuing(false);
      okRequestedRef.current = false;
    }

    function resetDisabledFlow() {
      disabledFlowRef.current = false;
      gateResolverRef.current = null;
    }

    function wrapLoginResponse(response) {
      return new Proxy(response, {
        get(target, property) {
          if (property === "json") {
            return async () => {
              try {
                return await target.json();
              } finally {
                window.setTimeout(closeNotice, 150);
              }
            };
          }

          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }

    async function guardedFetch(input, init) {
      const path = getRequestPath(input);

      if (path === REQUEST_OTP_PATH) {
        const response = await originalFetch(input, init);

        try {
          const data = await response.clone().json();

          if (response.ok && data?.otp_delivery === "disabled" && data?.login_otp) {
            disabledFlowRef.current = true;
            okRequestedRef.current = false;
            document.body.classList.add(BODY_CLASS);
            setOpen(true);
          }
        } catch {
          // Respons asli tetap diteruskan ke halaman login.
        }

        return response;
      }

      if (path === LOGIN_PATH && disabledFlowRef.current) {
        const responsePromise = originalFetch(input, init);

        await new Promise((resolve) => {
          gateResolverRef.current = resolve;
          if (okRequestedRef.current) resolve();
        });

        try {
          const response = await responsePromise;
          resetDisabledFlow();
          return wrapLoginResponse(response);
        } catch (error) {
          resetDisabledFlow();
          closeNotice();
          throw error;
        }
      }

      return originalFetch(input, init);
    }

    window.fetch = guardedFetch;

    return () => {
      if (window.fetch === guardedFetch) window.fetch = previousFetch;
      gateResolverRef.current?.();
      resetDisabledFlow();
      okRequestedRef.current = false;
      document.body.classList.remove(BODY_CLASS);
    };
  }, []);

  function handleContinue() {
    if (continuing) return;

    setContinuing(true);
    okRequestedRef.current = true;
    gateResolverRef.current?.();
  }

  return (
    <>
      <style jsx global>{`
        body.${BODY_CLASS} .toast-card {
          display: none !important;
        }

        body.${BODY_CLASS} .login-shell {
          pointer-events: none;
          user-select: none;
          opacity: 0.97;
        }
      `}</style>

      <ConfirmModal
        open={open}
        isDark={isDark}
        title="WhatsApp Services Disabled"
        message="WhatsApp Services is currently disabled. You do not need to enter an OTP. Please continue to the next step."
        confirmText="OK"
        hideCancel
        loading={continuing}
        overlayStyle={{
          background: isDark ? "rgba(2,6,23,.26)" : "rgba(15,23,42,.14)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
        modalStyle={{
          boxShadow: isDark
            ? "0 18px 48px rgba(0,0,0,.28)"
            : "0 18px 48px rgba(15,23,42,.16)",
        }}
        onCancel={() => {}}
        onConfirm={handleContinue}
      />
    </>
  );
}
