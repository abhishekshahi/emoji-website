"use client";

import Link from "next/link";
import { EmojiArtwork } from "@/components/emoji/emoji-artwork";
import type { ArtworkPanelView } from "@/lib/emoji/emoji-page-model";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
} from "@/lib/site/config";

interface EmojiArtworkPanelProps {
  hexcode: string;
  name: string;
  emoji: string;
  artwork: ArtworkPanelView;
  openmojiAuthor?: string;
}

function StatusIcon({ served }: { served: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
        served ? "bg-emerald-500/15 text-emerald-700" : "bg-surface-muted text-muted"
      }`}
      aria-hidden="true"
    >
      {served ? "✓" : "○"}
    </span>
  );
}

export function EmojiArtworkPanel({
  hexcode,
  name,
  emoji,
  artwork,
  openmojiAuthor,
}: EmojiArtworkPanelProps) {
  const servedProvider = artwork.providers.find((provider) => provider.publiclyServed);
  const indexedProviders = artwork.providers.filter(
    (provider) => provider.available && !provider.publiclyServed,
  );

  return (
    <section className="card-surface space-y-6 p-6 sm:p-8" aria-labelledby="artwork-heading">
      <div className="space-y-2">
        <h2 id="artwork-heading" className="section-title">
          Artwork styles
        </h2>
        <p className="section-subtitle">
          EmojiQuick serves OpenMoji artwork publicly. Other providers are indexed in the master
          database for future licensed display.
        </p>
      </div>

      {servedProvider ? (
        <div className="flex flex-col items-center gap-4 rounded-[1.25rem] border border-border bg-surface-muted/50 p-6 sm:p-8">
          <EmojiArtwork hexcode={hexcode} name={name} emoji={emoji} size="detail" />
          <p className="text-center text-sm text-muted">
            Primary artwork:{" "}
            <span className="font-medium text-foreground">{servedProvider.name}</span>
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted">Provider availability</h3>
        <ul className="space-y-3">
          {artwork.providers
            .filter((provider) => provider.available)
            .map((provider) => (
              <li
                key={provider.id}
                className="rounded-xl border border-border bg-surface-muted/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon served={provider.publiclyServed} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{provider.name}</p>
                      <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                        {provider.statusLabel}
                      </span>
                    </div>
                    <dl className="grid gap-2 text-sm text-muted sm:grid-cols-2">
                      <div>
                        <dt className="font-medium">Format</dt>
                        <dd className="uppercase">{provider.formats.join(", ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">License</dt>
                        <dd>{provider.license ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Assets indexed</dt>
                        <dd>{provider.assetCount}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Public availability</dt>
                        <dd>{provider.publiclyServed ? "Served on EmojiQuick" : "Indexed only"}</dd>
                      </div>
                    </dl>
                    {provider.publiclyServed ? (
                      <p className="text-sm text-muted">View artwork above.</p>
                    ) : (
                      <p className="text-sm text-muted">
                        Indexed in master database. Not publicly served until license-safe hosting is
                        enabled.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {indexedProviders.length > 0 ? (
        <p className="text-xs text-muted">
          {indexedProviders.map((provider) => provider.name).join(", ")} artwork is indexed for
          reference only and is not loaded in the browser.
        </p>
      ) : null}

      <p className="text-sm text-muted">
        {openmojiAuthor ? <>Artwork by {openmojiAuthor} via </> : <>Artwork via </>}
        <Link href={OPENMOJI_PROJECT_URL} className="text-accent-strong underline">
          OpenMoji
        </Link>{" "}
        (
        <Link href={OPENMOJI_LICENSE_URL} className="text-accent-strong underline">
          {OPENMOJI_LICENSE}
        </Link>
        ). See{" "}
        <Link href="/licenses" className="text-accent-strong underline">
          licenses &amp; attribution
        </Link>
        .
      </p>
    </section>
  );
}
