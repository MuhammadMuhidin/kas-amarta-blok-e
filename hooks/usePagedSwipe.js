import { useEffect, useState } from "react";

export default function usePagedSwipe(items = [], open = false, pageSize = 5, swipeThreshold = 45) {
  const [page, setPage] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    if (open) setPage(0);
  }, [open, items.length]);

  function goToPage(nextPage) {
    setPage(Math.min(Math.max(nextPage, 0), totalPages - 1));
  }

  function handleTouchStart(event) {
    setTouchStartX(event.touches?.[0]?.clientX ?? null);
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) return;

    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const deltaX = touchStartX - endX;

    if (Math.abs(deltaX) > swipeThreshold) {
      goToPage(safePage + (deltaX > 0 ? 1 : -1));
    }

    setTouchStartX(null);
  }

  return {
    page: safePage,
    pageItems,
    pageSize,
    totalPages,
    goToPage,
    handleTouchStart,
    handleTouchEnd,
  };
}
