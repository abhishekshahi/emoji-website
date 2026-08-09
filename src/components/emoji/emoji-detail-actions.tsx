"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/emoji/copy-button";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import type { BrowsableEmoji } from "@/lib/emoji/types";

interface EmojiDetailActionsProps {
  emoji: BrowsableEmoji;
}

export function EmojiDetailActions({ emoji }: EmojiDetailActionsProps) {
  const { isFavorite, toggleFavorite, addRecent } = useEmojiActions();
  const favorite = isFavorite(emoji.hexcode);
  const trackedHexcode = useRef<string | null>(null);
  const primaryShortcode = emoji.shortcodes[0];

  useEffect(() => {
    if (trackedHexcode.current === emoji.hexcode) {
      return;
    }

    trackedHexcode.current = emoji.hexcode;
    addRecent(emoji.hexcode);
  }, [addRecent, emoji.hexcode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <CopyButton
          label="Copy emoji"
          value={emoji.emoji}
          emojiId={emoji.hexcode}
          trackRecent
          toastMessage={`Copied ${emoji.emoji}`}
          variant="primary"
        />

        <button
          type="button"
          onClick={() => toggleFavorite(emoji.hexcode)}
          className="min-h-11 rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-muted"
          aria-label={
            favorite
              ? `Remove ${emoji.name} from favorites`
              : `Add ${emoji.name} to favorites`
          }
          aria-pressed={favorite}
        >
          {favorite ? "Remove favorite" : "Add to favorites"}
        </button>

        <Link
          href={`/search?q=${encodeURIComponent(emoji.name)}`}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-muted"
        >
          Search similar
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton
          label={emoji.codePointString}
          value={emoji.codePointString}
          emojiId={emoji.hexcode}
          toastMessage={`Copied ${emoji.codePointString}`}
        />
        <CopyButton
          label={emoji.hexcode}
          value={emoji.hexcode}
          emojiId={emoji.hexcode}
          toastMessage={`Copied ${emoji.hexcode}`}
        />
        {primaryShortcode ? (
          <CopyButton
            label={`:${primaryShortcode}:`}
            value={`:${primaryShortcode}:`}
            emojiId={emoji.hexcode}
            toastMessage={`Copied :${primaryShortcode}:`}
          />
        ) : null}
      </div>
    </div>
  );
}

interface RelatedEmojiGridProps {
  emojis: BrowsableEmoji[];
}

export function RelatedEmojiGrid({ emojis }: RelatedEmojiGridProps) {
  return <EmojiGrid emojis={emojis} pageSize={12} />;
}
