"use client";

import { useCallback, useMemo, useState } from "react";
import { EMOJI_GRID_PAGE_SIZE } from "@/lib/emoji/constants";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { useIntersectionLoadMore } from "@/hooks/use-intersection-load-more";
import { EmptyState } from "@/components/ui/empty-state";
import { EmojiCard } from "./emoji-card";

interface EmojiGridProps {
  emojis: BrowsableEmoji[];
  pageSize?: number;
  emptyMessage?: string;
  highlightQuery?: string;
  matchLabelsById?: Readonly<Record<string, string>>;
  /** When false, renders nothing if emojis is empty (caller handles empty UI). */
  showEmptyState?: boolean;
  /** Auto-load more rows when the sentinel enters the viewport. */
  infiniteScroll?: boolean;
}

export function EmojiGrid({
  emojis,
  pageSize = EMOJI_GRID_PAGE_SIZE,
  emptyMessage = "No emojis to show yet.",
  highlightQuery,
  matchLabelsById,
  showEmptyState = true,
  infiniteScroll = true,
}: EmojiGridProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleEmojis = useMemo(
    () => emojis.slice(0, visibleCount),
    [emojis, visibleCount],
  );

  const hasMore = visibleCount < emojis.length;

  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + pageSize, emojis.length));
  }, [emojis.length, pageSize]);

  const sentinelRef = useIntersectionLoadMore({
    enabled: infiniteScroll && hasMore,
    onLoadMore: loadMore,
  });

  if (emojis.length === 0) {
    if (!showEmptyState) {
      return null;
    }
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="space-y-6">
      <div
        className="emoji-grid"
        role="list"
        aria-label={`${emojis.length} emoji${emojis.length === 1 ? "" : "s"}`}
      >
        {visibleEmojis.map((emoji) => (
          <div key={emoji.id} role="listitem" className="emoji-grid__item">
            <EmojiCard
              emoji={emoji}
              highlightQuery={highlightQuery}
              matchLabel={matchLabelsById?.[emoji.id]}
            />
          </div>
        ))}
      </div>

      {hasMore ? (
        <>
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              className="btn btn--secondary btn--md min-h-11"
              aria-label={`Load more emojis, ${emojis.length - visibleCount} remaining`}
            >
              Load more ({emojis.length - visibleCount} remaining)
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
