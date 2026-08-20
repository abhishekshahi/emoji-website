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
    <section className="detail-hero card-surface overflow-hidden">
      <div className="detail-hero__grid">
        <div className="detail-hero__visual">
          <EmojiArtwork
            hexcode={emoji.hexcode}
            name={emoji.name}
            emoji={emoji.emoji}
            size="detail"
            priority
            className="detail-hero__artwork"
          />
        </div>

        <div className="detail-hero__content">
          <div className="space-y-3">
            <p className="section-header__eyebrow">
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
            <h1 className="text-display">{emoji.name}</h1>
            <p className="text-lead max-w-2xl">
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
              <p className="text-sm text-muted">
                OpenMoji Extra · {emoji.codePointString}
              </p>
            )}
          </div>

          <div className="detail-hero__actions">
            <CopyButton
              label={`Copy ${emoji.emoji}`}
              value={emoji.emoji}
              emojiId={emoji.hexcode}
              trackRecent
              toastMessage={`Copied ${emoji.emoji}`}
              variant="primary"
              size="lg"
            />
            <button
              type="button"
              onClick={() => toggleFavorite(emoji.hexcode)}
              className={`btn btn--secondary btn--md ${
                favorite ? "btn--soft" : ""
              }`}
              aria-label={
                favorite
                  ? `Remove ${emoji.name} from favorites`
                  : `Add ${emoji.name} to favorites`
              }
              aria-pressed={favorite}
            >
              {favorite ? "Saved" : "Save"}
            </button>
            <CopyButton
              label="Copy page URL"
              value={pageUrl}
              toastMessage="Copied page URL"
              variant="ghost"
              size="md"
            />
            <Link
              href={`/search?q=${encodeURIComponent(emoji.name)}`}
              className="btn btn--secondary btn--md"
            >
              Search similar
            </Link>
          </div>

          <div className="detail-hero__meta">
            <CopyButton
              label={emoji.codePointString}
              value={emoji.codePointString}
              emojiId={emoji.hexcode}
              toastMessage={`Copied ${emoji.codePointString}`}
              size="sm"
            />
            <CopyButton
              label={emoji.hexcode}
              value={emoji.hexcode}
              emojiId={emoji.hexcode}
              toastMessage={`Copied ${emoji.hexcode}`}
              size="sm"
            />
            {emoji.shortcodes[0] ? (
              <CopyButton
                label={`:${emoji.shortcodes[0]}:`}
                value={`:${emoji.shortcodes[0]}:`}
                emojiId={emoji.hexcode}
                toastMessage={`Copied :${emoji.shortcodes[0]}:`}
                size="sm"
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
