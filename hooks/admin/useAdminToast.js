"use client";

import { useCallback, useState } from "react";

export default function useAdminToast() {
  const [popup, setPopup] = useState(null);

  const showPopup = useCallback((text, type = "success") => {
    setPopup({ text, type });
    window.setTimeout(() => setPopup(null), 2500);
  }, []);

  return {
    popup,
    showPopup,
  };
}
