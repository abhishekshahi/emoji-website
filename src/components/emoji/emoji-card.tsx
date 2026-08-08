"use client";

import Link from "next/link";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiArtwork } from "@/components/emoji/emoji-artwork";
import type { EmojiRecord } from "@/lib/emoji/types";

interface EmojiCardProps {
  emoji: Pick<EmojiRecord, "id" | "emoji" | "name" | "slug" | "hexcode">;
  showName?: boolean;
}

export function EmojiCard({ emoji, showName = true }: EmojiCardProps) {
  const { isFavorite, toggleFavorite, copyEmoji } = useEmojiActions();
  const favorite = isFavorite(emoji.hexcode);

  const handleCopy = async () => {
    await copyEmoji(emoji.hexcode, emoji.emoji);
  };

  return (
    <article className="group relative">
      <div className="card-surface flex h-full flex-col items-center gap-3 p-4 transition hover:-translate-y-0.5">
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full flex-col items-center gap-3 rounded-2xl bg-surface-muted/70 px-2 py-4 transition hover:bg-accent-soft focus-visible:outline-offset-4"
          aria-label={`Copy ${emoji.name} emoji`}
        >
          <EmojiArtwork
            hexcode={emoji.hexcode}
            name={emoji.name}
            emoji={emoji.emoji}
            size="card"
          />
          {showName ? (
            <span className="line-clamp-2 text-center text-sm font-medium text-foreground">
              {emoji.name}
            </span>
          ) : null}
        </button>

        <div className="flex w-full items-center justify-between gap-2">
          <Link
            href={`/emoji/${emoji.slug}`}
            className="text-xs font-semibold text-accent-strong hover:underline"
          >
            Details
          </Link>

        <button
          type="button"
          onClick={() => toggleFavorite(emoji.hexcode)}
          className="min-h-11 rounded-full px-3 py-1.5 text-sm transition hover:bg-surface-muted"
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
      </div>
    </article>
  );
}
