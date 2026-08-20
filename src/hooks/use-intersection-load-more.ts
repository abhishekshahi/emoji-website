"use client";
import { useEffect, useRef, type RefObject } from "react";
interface UseIntersectionLoadMoreOptions { enabled: boolean; onLoadMore: () => void; rootMargin?: string; }
export function useIntersectionLoadMore({ enabled, onLoadMore, rootMargin = "320px" }: UseIntersectionLoadMoreOptions): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore(); }, { rootMargin, threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin]);
  return sentinelRef;
}
