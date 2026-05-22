"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function useInfiniteRows({
  buildUrl,
  deps = [],
  pageSize = 10,
  getItems,
  getPagination,
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loaderRef = useRef(null);
  const abortRef = useRef(null);

  const hasMore = page < totalPages;
  const depsKey = useMemo(() => JSON.stringify(deps), deps);

  const loadPage = useCallback(
    async (nextPage = 1, mode = "replace") => {
      const isAppend = mode === "append";

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      if (isAppend) setLoadingMore(true);
      else setLoading(true);

      setError("");

      try {
        const res = await fetch(
          buildUrl({ page: nextPage, limit: pageSize }),
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load data");
        }

        const nextItems = getItems(data) || [];
        const pagination = getPagination(data) || {};
        const resolvedTotal = Number(
          pagination.total || nextItems.length || 0,
        );
        const resolvedTotalPages = Math.max(
          Number(
            pagination.total_pages ||
              Math.ceil(resolvedTotal / pageSize) ||
              1,
          ),
          1,
        );

        setItems((prev) =>
          isAppend ? [...prev, ...nextItems] : nextItems,
        );
        setPage(Number(pagination.page || nextPage));
        setTotal(resolvedTotal);
        setTotalPages(resolvedTotalPages);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load data");
          if (!isAppend) setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [buildUrl, getItems, getPagination, pageSize],
  );

  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setTotal(0);
    setTotalPages(1);
    return loadPage(1, "replace");
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    return loadPage(page + 1, "append");
  }, [hasMore, loadPage, loading, loadingMore, page]);

  useEffect(() => {
    refresh();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [depsKey, refresh]);

  useEffect(() => {
    const node = loaderRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "120px",
        threshold: 0,
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return {
    items,
    page,
    total,
    totalPages,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refresh,
    loadMore,
  };
}
