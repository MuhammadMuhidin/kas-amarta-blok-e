"use client";

import { useRouter } from "next/navigation";

export default function useAdminSession() {
  const router = useRouter();

  async function checkSession() {
    const res = await fetch("/api/admin/sessions/check", { cache: "no-store" });

    if (res.status !== 401) return true;

    router.replace("/login");
    return false;
  }

  return { checkSession };
}
