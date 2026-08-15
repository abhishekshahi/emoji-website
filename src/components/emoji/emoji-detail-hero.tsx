"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/emoji/copy-button";
import { EmojiArtwork } from "@/components/emoji/emoji-artwork";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { isOpenMojiExtra } from "@/lib/emoji/types";

interface EmojiDetailHeroProps {
  emoji: BrowsableEmoji;
  canonicalSlug: string;
  categoryLabel: string;
  summary: string | null;
  pageUrl: string;
}

export function EmojiDetailHero({
  emoji,
  canonicalSlug,
  categoryLabel,
  summary,
  pageUrl,
}: EmojiDetailHeroProps) {
  const { isFavorite, toggleFavorite, addRecent } = useEmojiActions();
  const favorite = isFavorite(emoji.hexcode);
  const trackedHexcode = useRef<string | null>(null);
  const extra = isOpenMojiExtra(emoji);

  useEffect(() => {
    if (trackedHexcode.current === emoji.hexcode) {
      return;
    }

    trackedHexcode.current = emoji.hexcode;
    addRecent(emoji.hexcode);
  }, [addRecent, emoji.hexcode]);

  return (
    <section className="card-surface overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="flex flex-col items-center justify-center gap-4 bg-surface-muted/70 px-6 py-10 sm:px-8">
          <EmojiArtwork
            hexcode={emoji.hexcode}
            name={emoji.name}
            emoji={emoji.emoji}
            size="detail"
            priority
            className="drop-shadow-sm"
          />
          <span
            className="text-6xl leading-none sm:text-7xl"
            role="img"
            aria-label={`${emoji.name} emoji`}
          >
            {emoji.emoji}
          </span>
        </div>

        <div className="flex flex-col justify-center gap-6 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-strong">
              <Link href={`/category/${emoji.category}`} className="hover:underline">
                {categoryLabel}
              </Link>
              <span className="mx-2 text-muted" aria-hidden="true">
                ·
              </span>
              <span className="capitalize text-muted">
                {emoji.subcategory.replace(/-/g, " ")}
              </span>
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {emoji.name} {emoji.emoji}
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              {summary ??
                (extra
                  ? `Copy ${emoji.name}, explore OpenMoji artwork, and browse related extras.`
                  : `Copy ${emoji.name} instantly, explore Unicode details, variants, and related emojis.`)}
            </p>
            {!extra ? (
              <p className="text-sm text-muted">
                Unicode {emoji.codePointString}
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                Version {emoji.unicodeVersion}
              </p>
            ) : (
              <p className="text-sm text-muted">OpenMoji Extra · {emoji.codePointString}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <CopyButton
              label={`Copy ${emoji.emoji}`}
              value={emoji.emoji}
              emojiId={emoji.hexcode}
              trackRecent
              toastMessage={`Copied ${emoji.emoji}`}
              variant="primary"
              className="!px-6 !py-3.5 !text-base"
            />
            <CopyButton
              label="Copy page URL"
              value={pageUrl}
              toastMessage="Copied page URL"
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
              {favorite ? "Saved" : "Save"}
            </button>
            <Link
              href={`/search?q=${encodeURIComponent(emoji.name)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-muted"
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
            {emoji.shortcodes[0] ? (
              <CopyButton
                label={`:${emoji.shortcodes[0]}:`}
                value={`:${emoji.shortcodes[0]}:`}
                emojiId={emoji.hexcode}
                toastMessage={`Copied :${emoji.shortcodes[0]}:`}
              />
            ) : null}
          </div>

          <p className="sr-only" id={`emoji-page-${canonicalSlug}`}>
            Emoji detail page for {emoji.name}. Primary action is copy emoji.
          </p>
        </div>
      </div>
    </section>
  );
}
