"use client";

import Link from "next/link";
import type { EmojiPlatformComparisonView } from "@/lib/emoji/platforms/types";

interface EmojiPlatformComparisonSectionProps {
  readonly comparison: EmojiPlatformComparisonView;
  readonly emojiSlug: string;
}

export function EmojiPlatformComparisonSection({
  comparison,
  emojiSlug,
}: EmojiPlatformComparisonSectionProps) {
  const tiles = comparison.openSourceTiles;

  return (
    <section className="card-surface space-y-6 p-6 sm:p-8" aria-labelledby="platform-comparison-heading">
      <div className="space-y-2">
        <h2 id="platform-comparison-heading" className="section-title">
          Unicode &amp; open-source styles
        </h2>
        <p className="section-subtitle">
          The Unicode character <span className="font-medium">{comparison.unicodeGlyph}</span> (
          {comparison.codePointString}) is the same code point everywhere. Open-source reference artwork below
          is served on EmojiQuick where licensed.{" "}
          <Link href="/emoji/platforms" className="text-accent-strong underline">
            Platform guide
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
        <h3 className="text-sm font-semibold">Unicode character</h3>
        <p className="text-5xl leading-none" aria-hidden="true">
          {comparison.unicodeGlyph}
        </p>
        <dl className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <div>
            <dt className="font-medium">Code point</dt>
            <dd>{comparison.codePointString}</dd>
          </div>
          <div>
            <dt className="font-medium">Unicode version</dt>
            <dd>{comparison.unicodeVersion}</dd>
          </div>
        </dl>
      </div>

      {tiles.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Open-source reference artwork</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <li
                key={tile.provider}
                className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3"
              >
                <p className="text-sm font-semibold">{tile.label}</p>
                {tile.url ? (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tile.url}
                      alt={`${comparison.name} — ${tile.label} reference artwork`}
                      width={72}
                      height={72}
                      loading="lazy"
                      decoding="async"
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-center text-4xl" aria-hidden="true">
                    {comparison.unicodeGlyph}
                  </p>
                )}
                <p className="text-xs text-muted">{tile.license}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-muted">{comparison.vendorNote}</p>

      <p className="text-sm">
        <Link href={`/emoji/platforms/open-source-styles`} className="pill-link">
          Compare open-source styles
        </Link>{" "}
        <Link href={`/emoji/${emojiSlug}`} className="pill-link">
          {comparison.name} detail
        </Link>
      </p>
    </section>
  );
}
