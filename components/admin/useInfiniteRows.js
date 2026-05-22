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
  const buildUrlRef = useRef(buildUrl);
  const getItemsRef = useRef(getItems);
  const getPaginationRef = useRef(getPagination);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);

  const hasMore = page < totalPages;
  const depsKey = useMemo(() => JSON.stringify(deps), deps);

  useEffect(() => {
    buildUrlRef.current = buildUrl;
    getItemsRef.current = getItems;
    getPaginationRef.current = getPagination;
  }, [buildUrl, getItems, getPagination]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  const loadPage = useCallback(
    async (nextPage = 1, mode = "replace") => {
      const isAppend = mode === "append";

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      if (isAppend) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        loadingRef.current = true;
        setLoading(true);
      }

      setError("");

      try {
        const res = await fetch(
          buildUrlRef.current({ page: nextPage, limit: pageSize }),
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load data");
        }

        const nextItems = getItemsRef.current(data) || [];
        const pagination = getPaginationRef.current(data) || {};
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
        const resolvedPage = Number(pagination.page || nextPage);

        setItems((prev) =>
          isAppend ? [...prev, ...nextItems] : nextItems,
        );
        setPage(resolvedPage);
        setTotal(resolvedTotal);
        setTotalPages(resolvedTotalPages);

        pageRef.current = resolvedPage;
        totalPagesRef.current = resolvedTotalPages;
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load data");
          if (!isAppend) setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          loadingMoreRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [pageSize],
  );

  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setTotal(0);
    setTotalPages(1);
    pageRef.current = 1;
    totalPagesRef.current = 1;

    return loadPage(1, "replace");
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (
      loadingRef.current ||
      loadingMoreRef.current ||
      pageRef.current >= totalPagesRef.current
    ) {
      return;
    }

    return loadPage(pageRef.current + 1, "append");
  }, [loadPage]);

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
