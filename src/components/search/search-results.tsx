"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEmojiSearch } from "@/hooks/use-emoji-search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { isAmbiguousSearchQuery } from "@/lib/emoji/search-highlight";
import { getSearchMatchLabel } from "@/lib/emoji/search-match";
import { SEARCH_CATEGORY_HINTS, SEARCH_SUGGESTIONS } from "@/lib/emoji/search-suggestions";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { RecentlyUsedSection } from "@/components/home/recently-used-section";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/chip";
import { EmojiGridSkeleton } from "@/components/ui/skeleton";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const trimmedQuery = query.trim();
  const { results, isReady } = useEmojiSearch(trimmedQuery);

  const { emojis, matchLabelsById } = useMemo(() => {
    const labels: Record<string, string> = {};
    const resolved = results
      .map((result) => {
        const emoji = result.emoji;
        if (!emoji) return null;
        const label = getSearchMatchLabel(result.score);
        if (label) labels[emoji.id] = label;
        return emoji;
      })
      .filter((emoji): emoji is BrowsableEmoji => Boolean(emoji));

    return { emojis: resolved, matchLabelsById: labels };
  }, [results]);

  if (!trimmedQuery) {
    return (
      <div className="space-y-8">
        <RecentlyUsedSection />
        <EmptyState
          title="Start typing to search"
          description="Search by name, keyword, meaning, synonym, emoji character, hex code, or Unicode code point."
        >
        <div className="flex flex-wrap justify-center gap-2">
          {SEARCH_SUGGESTIONS.slice(0, 6).map((suggestion) => (
            <ChipLink
              key={suggestion}
              href={`/search?q=${encodeURIComponent(suggestion)}`}
            >
              {suggestion}
            </ChipLink>
          ))}
        </div>
        </EmptyState>
      </div>
    );
  }

  if (!isReady) {
    return <EmojiGridSkeleton count={12} />;
  }

  const ambiguous = isAmbiguousSearchQuery(trimmedQuery);

  if (emojis.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          0 results for{" "}
          <span className="font-semibold text-foreground">
            &quot;{trimmedQuery}&quot;
          </span>
        </p>
        <EmptyState
          title="No emoji found"
          description={`Nothing matched "${trimmedQuery}". Try one of these instead.`}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <ChipLink
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
              >
                {suggestion}
              </ChipLink>
            ))}
          </div>
          <p className="mt-3 w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Browse by category
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SEARCH_CATEGORY_HINTS.map((hint) => (
              <ChipLink
                key={hint.label}
                href={`/search?q=${encodeURIComponent(hint.query)}`}
                variant="outline"
              >
                {hint.label}
              </ChipLink>
            ))}
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {emojis.length} result{emojis.length === 1 ? "" : "s"} for{" "}
        <span className="font-semibold text-foreground">
          &quot;{trimmedQuery}&quot;
        </span>
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
        showEmptyState={false}
      />
    </div>
  );
}
