"use client";

import Link from "next/link";
import { memo, useCallback, useState } from "react";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiArtwork } from "@/components/emoji/emoji-artwork";
import { getSearchHighlightSegments } from "@/lib/emoji/search-highlight";
import type { BrowsableEmoji } from "@/lib/emoji/types";

interface EmojiCardProps {
  emoji: Pick<BrowsableEmoji, "id" | "emoji" | "name" | "slug" | "hexcode">;
  showName?: boolean;
  highlightQuery?: string;
  matchLabel?: string;
}

function EmojiCardComponent({ emoji, showName = true, highlightQuery, matchLabel }: EmojiCardProps) {
  const { isFavorite, toggleFavorite, copyEmoji } = useEmojiActions();
  const favorite = isFavorite(emoji.hexcode);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await copyEmoji(emoji.hexcode, emoji.emoji);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [copyEmoji, emoji.emoji, emoji.hexcode]);

  const handleFavorite = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      toggleFavorite(emoji.hexcode);
    },
    [emoji.hexcode, toggleFavorite],
  );

  return (
    <article className="emoji-card group p-3">
      <button
        type="button"
        onClick={handleCopy}
        className={`emoji-card__copy ${copied ? "emoji-card__copy--copied" : ""}`}
        aria-label={`Copy ${emoji.name} emoji`}
      >
          <EmojiArtwork
            hexcode={emoji.hexcode}
            name={emoji.name}
            emoji={emoji.emoji}
            size="card"
          />
          {showName ? (
            <span className="emoji-card__name text-foreground">
              {highlightQuery
                ? getSearchHighlightSegments(emoji.name, highlightQuery).map((segment, index) =>
                    segment.highlight ? (
                      <mark
                        key={`${segment.text}-${index}`}
                        className="rounded bg-accent-soft px-0.5 text-foreground"
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={`${segment.text}-${index}`}>{segment.text}</span>
                    ),
                  )
                : emoji.name}
            </span>
          ) : null}
        {copied ? (
          <span className="text-xs font-semibold text-success" role="status">
            Copied!
          </span>
        ) : null}
        {matchLabel ? (
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {matchLabel}
            </span>
        ) : null}
      </button>

      <div className="emoji-card__actions">
          <Link
            href={`/emoji/${emoji.slug}`}
            className="min-h-11 inline-flex items-center text-xs font-semibold text-accent-strong hover:underline"
            aria-label={`View details for ${emoji.name}`}
          >
            Details
          </Link>

          <button
            type="button"
            onClick={handleFavorite}
            className={`min-h-11 rounded-full px-3 py-1.5 text-base transition hover:bg-surface-muted ${
            favorite ? "text-accent-strong" : "text-muted"
          }`}
            aria-label={
              favorite
                ? `Remove ${emoji.name} from favorites`
                : `Add ${emoji.name} to favorites`
            }
            aria-pressed={favorite}
          >
            {favorite ? "★" : "☆"}
          </button>
      </div>
    </article>
  );
}

export const EmojiCard = memo(EmojiCardComponent);
