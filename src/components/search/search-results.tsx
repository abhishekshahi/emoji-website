"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEmojiSearch } from "@/hooks/use-emoji-search";
import { getEmojiById } from "@/lib/emoji/data";
import { EmojiGrid } from "@/components/emoji/emoji-grid";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const { results, isReady } = useEmojiSearch(query);

  const emojis = useMemo(
    () =>
      results
        .map((result) => getEmojiById(result.emoji.id))
        .filter((emoji): emoji is NonNullable<typeof emoji> => Boolean(emoji)),
    [results],
  );

  if (!query.trim()) {
    return (
      <div className="card-surface px-6 py-12 text-center">
        <p className="text-lg font-semibold">Start typing to search emojis</p>
        <p className="mt-2 text-sm text-muted">
          Search by name, keyword, emoji character, hex code, or Unicode code point.
        </p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div
        className="card-surface px-6 py-12 text-center text-muted"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        Loading emoji search index...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {emojis.length} result{emojis.length === 1 ? "" : "s"} for{" "}
        <span className="font-semibold text-foreground">&quot;{query}&quot;</span>
      </p>
      <EmojiGrid
        emojis={emojis}
        emptyMessage={`No emojis matched "${query}". Try another keyword or code point.`}
      />
    </div>
  );
}
