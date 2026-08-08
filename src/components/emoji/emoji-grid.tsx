"use client";

import { useMemo, useState } from "react";
import { EMOJI_GRID_PAGE_SIZE } from "@/lib/emoji/constants";
import type { EmojiRecord } from "@/lib/emoji/types";
import { EmojiCard } from "./emoji-card";

interface EmojiGridProps {
  emojis: EmojiRecord[];
  pageSize?: number;
  emptyMessage?: string;
}

export function EmojiGrid({
  emojis,
  pageSize = EMOJI_GRID_PAGE_SIZE,
  emptyMessage = "No emojis to show yet.",
}: EmojiGridProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleEmojis = useMemo(
    () => emojis.slice(0, visibleCount),
    [emojis, visibleCount],
  );

  if (emojis.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleEmojis.map((emoji) => (
          <EmojiCard key={emoji.id} emoji={emoji} />
        ))}
      </div>

      {visibleCount < emojis.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + pageSize)}
            className="rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-muted"
          >
            Load more ({emojis.length - visibleCount} remaining)
          </button>
        </div>
      ) : null}
    </div>
  );
}
