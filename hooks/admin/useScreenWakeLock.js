"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function useScreenWakeLock(active) {
  const wakeLockRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function releaseLock() {
      try {
        await wakeLockRef.current?.release?.();
      } catch {
        // Browser/OS can release the lock by itself. Ignore release errors.
      } finally {
        wakeLockRef.current = null;
        if (!cancelled) setLocked(false);
      }
    }

    async function requestLock() {
      if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
        await releaseLock();
        return;
      }

      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release?.();
          return;
        }

        wakeLockRef.current = lock;
        setLocked(true);

        lock.addEventListener("release", () => {
          if (wakeLockRef.current === lock) {
            wakeLockRef.current = null;
            setLocked(false);
          }
        });
      } catch {
        wakeLockRef.current = null;
        if (!cancelled) setLocked(false);
      }
    }

    requestLock();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && active && !wakeLockRef.current) {
        requestLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [active]);

  return useMemo(() => ({ supported, locked }), [supported, locked]);
}
