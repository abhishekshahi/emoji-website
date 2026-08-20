"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  fetchCatalogPage,
  mapCatalogItemToBrowsable,
} from "@/lib/emoji/catalog-browse-client";
import { MASTER_IDENTITY_COUNT } from "@/lib/master/r2/catalog";

const PAGE_SIZE = 100;

export function useCatalogBrowse() {
  const [emojis, setEmojis] = useState<BrowsableEmoji[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number>(MASTER_IDENTITY_COUNT);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadPage = useCallback(async (nextPage: number) => {
    const result = await fetchCatalogPage(nextPage, PAGE_SIZE);
    if (!result) return false;

    const mapped = result.items
      .map((item) => mapCatalogItemToBrowsable(item))
      .filter((entry): entry is BrowsableEmoji => Boolean(entry));

    setEmojis((prev) => {
      const seen = new Set(prev.map((e) => e.slug));
      const merged = [...prev];
      for (const entry of mapped) {
        if (seen.has(entry.slug)) continue;
        seen.add(entry.slug);
        merged.push(entry);
      }
      return merged;
    });
    setPage(result.page);
    setTotal(result.total);
    setTotalPages(result.totalPages);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPage(1).then((ok) => {
      if (!cancelled) setIsReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    await loadPage(page + 1);
    setIsLoadingMore(false);
  }, [isLoadingMore, loadPage, page, totalPages]);

  const hasMore = page < totalPages;

  return {
    emojis,
    total,
    isReady,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
