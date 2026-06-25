"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminAccessRoleInitials, getAdminAccessRoleLabel } from "@/lib/adminRoles";

const ROLE_CACHE_KEY = "amarta_admin_role_cache";
const VALID_ROLES = new Set(["admin", "ketua", "sekretaris", "bendahara", "sapras"]);

function normalizeRole(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_ROLES.has(raw) ? raw : null;
}

function getCachedRole() {
  try {
    return normalizeRole(localStorage.getItem(ROLE_CACHE_KEY));
  } catch {
    return null;
  }
}

function setCachedRole(role) {
  try {
    if (role) localStorage.setItem(ROLE_CACHE_KEY, role);
    else localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    // ignore
  }
}

export default function AdminProfileLink({ compact = false }) {
  const [role, setRole] = useState(getCachedRole);

  useEffect(() => {
    let active = true;
    let controller = null;

    async function loadRole() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;

      try {
        const res = await fetch(`/api/admin/sessions/check?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: requestController.signal,
        });
        const data = res.ok ? await res.json() : null;
        const normalized = normalizeRole(data?.access_role);
        if (active && controller === requestController) {
          setRole(normalized);
          setCachedRole(normalized);
        }
      } catch (error) {
        if (error.name !== "AbortError" && active && controller === requestController) {
          // don't wipe valid cache on transient errors
        }
      }
    }

    const pageShow = () => loadRole();
    const visibility = () => document.visibilityState === "visible" && loadRole();
    loadRole();
    window.addEventListener("pageshow", pageShow);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("pageshow", pageShow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const label = role ? getAdminAccessRoleLabel(role) : null;
  const initials = role ? getAdminAccessRoleInitials(role) : null;

  return (
    <Link
      href="/admin/profile"
      className={compact ? "admin-profile-link admin-profile-link-compact" : "admin-profile-link"}
      aria-label={label ? `Buka profile ${label}` : "Buka profile"}
    >
      {initials && <span className="admin-profile-avatar">{initials}</span>}
      {!compact && label && <span className="admin-profile-label">{label}</span>}
    </Link>
  );
}
