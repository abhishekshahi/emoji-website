"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEmojiSearch } from "@/hooks/use-emoji-search";
import { getBrowsableEmojiById } from "@/lib/emoji/browsable-data";
import { isAmbiguousSearchQuery } from "@/lib/emoji/search-highlight";
import { getSearchMatchLabel } from "@/lib/emoji/search-match";
import { SEARCH_CATEGORY_HINTS, SEARCH_SUGGESTIONS } from "@/lib/emoji/search-suggestions";
import { EmojiGrid } from "@/components/emoji/emoji-grid";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const trimmedQuery = query.trim();
  const { results, isReady } = useEmojiSearch(trimmedQuery);

  const { emojis, matchLabelsById } = useMemo(() => {
    const labels: Record<string, string> = {};
    const resolved = results
      .map((result) => {
        const emoji = getBrowsableEmojiById(result.emoji.id);
        if (!emoji) return null;
        const label = getSearchMatchLabel(result.score);
        if (label) labels[emoji.id] = label;
        return emoji;
      })
      .filter((emoji): emoji is NonNullable<typeof emoji> => Boolean(emoji));

    return { emojis: resolved, matchLabelsById: labels };
  }, [results]);

  if (!trimmedQuery) {
    return (
      <div className="card-surface px-6 py-12 text-center">
        <p className="text-lg font-semibold">Start typing to search emojis</p>
        <p className="mt-2 text-sm text-muted">
          Search by name, keyword, meaning, synonym, emoji character, hex code, or Unicode code
          point.
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

  const ambiguous = isAmbiguousSearchQuery(trimmedQuery);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {emojis.length} result{emojis.length === 1 ? "" : "s"} for{" "}
        <span className="font-semibold text-foreground">&quot;{trimmedQuery}&quot;</span>
      </p>
      {ambiguous ? (
        <p className="rounded-2xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-muted">
          Multiple matches — this term can refer to more than one emoji.
        </p>
      ) : null}
      <EmojiGrid
        emojis={emojis}
        highlightQuery={trimmedQuery}
        matchLabelsById={matchLabelsById}
        emptyMessage={`No emojis matched "${trimmedQuery}". Try another keyword, meaning, or code point.`}
      />
      {emojis.length === 0 && isReady ? (
        <div className="card-surface space-y-4 px-6 py-6">
          <p className="text-sm font-semibold">Try these searches</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <Link
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
                className="rounded-full bg-surface-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent-soft hover:text-accent-strong"
              >
                {suggestion}
              </Link>
            ))}
          </div>
          <p className="text-sm font-semibold">Browse by category</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_CATEGORY_HINTS.map((hint) => (
              <Link
                key={hint.label}
                href={`/search?q=${encodeURIComponent(hint.query)}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent-strong"
              >
                {hint.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
