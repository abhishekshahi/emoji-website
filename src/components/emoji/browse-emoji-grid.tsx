"use client";

import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { useCatalogBrowse } from "@/hooks/use-catalog-browse";

export function BrowseEmojiGrid() {
  const { emojis, total, isReady, isLoadingMore, hasMore, loadMore } = useCatalogBrowse();

  if (!isReady) {
    return (
      <div className="card-surface px-6 py-12 text-center text-muted">
        Loading emoji collection...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted" role="status">
        Showing {emojis.length.toLocaleString()} of {total.toLocaleString()} emojis
      </p>
      <EmojiGrid emojis={emojis} pageSize={120} />
      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            className="min-h-11 rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-muted disabled:opacity-60"
            aria-label={
              isLoadingMore
                ? "Loading more emojis"
                : `Load next catalog page, ${(total - emojis.length).toLocaleString()} remaining`
            }
          >
            {isLoadingMore
              ? "Loading more..."
              : `Load next page (${(total - emojis.length).toLocaleString()} remaining)`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
