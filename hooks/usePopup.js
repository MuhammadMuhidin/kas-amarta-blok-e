import { useCallback, useRef, useState } from "react";

export default function usePopup(duration = 2500) {
  const [popup, setPopup] = useState(null);
  const timeoutRef = useRef(null);

  const showPopup = useCallback((text, type = "success") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setPopup({ text, type });

    timeoutRef.current = setTimeout(() => {
      setPopup(null);
    }, duration);
  }, [duration]);

  return {
    popup,
    showPopup,
    clearPopup: () => setPopup(null),
  };
}
