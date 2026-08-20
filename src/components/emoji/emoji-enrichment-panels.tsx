import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import type { EmojiEnrichmentRecord, EnrichmentArtworkProvider } from "@/lib/emoji/enrichment-types";
import { getEnrichmentArtworkProviders } from "@/lib/emoji/enrichment-artwork";
import { filterPublicDefinitions } from "@/lib/master/public/asset-rights";
import type { BrowsableEmoji } from "@/lib/emoji/types";

const PROVIDER_LABELS: Record<EnrichmentArtworkProvider, string> = {
  openmoji: "OpenMoji",
  noto: "Noto Emoji",
  twemoji: "Twemoji",
  fluent: "Fluent Emoji",
} as const;

interface EmojiEnrichmentPanelsProps {
  emoji: BrowsableEmoji;
  enrichment: EmojiEnrichmentRecord;
}

export function EmojiEnrichmentPanels({ emoji, enrichment }: EmojiEnrichmentPanelsProps) {
  const publicDefinitions = filterPublicDefinitions(enrichment.definitions);
  const variantEmojis = enrichment.variants
    .map((variant) => getBrowsableEmojiBySlug(variant.slug))
    .filter((entry): entry is BrowsableEmoji => Boolean(entry));

  const hasMeaning = publicDefinitions.length > 0;
  const hasAliases = enrichment.aliases.length > 0;
  const hasSearchTerms = enrichment.searchTerms.length > emoji.keywords.length;
  const hasVariants = variantEmojis.length > 0;
  const extraProviders = getEnrichmentArtworkProviders(enrichment).filter(
    (provider) => provider !== "openmoji",
  );

  if (!hasMeaning && !hasAliases && !hasSearchTerms && !hasVariants && extraProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {hasMeaning ? (
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-lg font-semibold">Meaning &amp; context</h2>
          <div className="space-y-3">
            {publicDefinitions.map((definition) => (
              <blockquote key={`${definition.source}-${definition.text.slice(0, 24)}`} className="border-l-4 border-accent-strong/40 pl-4 text-muted">
                <p>{definition.text}</p>
                <footer className="mt-2 text-xs uppercase tracking-wide text-muted">
                  Source: {definition.source}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      {hasAliases || hasSearchTerms ? (
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-lg font-semibold">Names &amp; search terms</h2>
          {enrichment.officialName && enrichment.officialName.toLowerCase() !== emoji.name.toLowerCase() ? (
            <p className="text-sm text-muted">
              Official Unicode name: <span className="font-medium text-foreground">{enrichment.officialName}</span>
            </p>
          ) : null}
          {hasAliases ? (
            <div>
              <h3 className="text-sm font-semibold text-muted">Also known as</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {enrichment.aliases.map((alias) => (
                  <li key={alias} className="rounded-full bg-surface-muted px-3 py-1 text-sm">
                    {alias}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hasSearchTerms ? (
            <div>
              <h3 className="text-sm font-semibold text-muted">Discoverable through</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {enrichment.searchTerms
                  .filter((term) => !emoji.keywords.some((keyword) => keyword.toLowerCase() === term.toLowerCase()))
                  .slice(0, 18)
                  .map((term) => (
                    <li key={term}>
                      <Link
                        href={`/search?q=${encodeURIComponent(term)}`}
                        className="rounded-full border border-border px-3 py-1 text-sm transition hover:bg-surface-muted"
                      >
                        {term}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasVariants ? (
        <section className="space-y-4">
          <h2 className="section-title">Variants</h2>
          <p className="section-subtitle">Related Unicode forms for this emoji identity.</p>
          <EmojiGrid emojis={variantEmojis} pageSize={variantEmojis.length} />
        </section>
      ) : null}

      {extraProviders.length > 0 ? (
        <section className="card-surface space-y-3 p-6">
          <h2 className="text-lg font-semibold">Artwork sources in database</h2>
          <p className="text-sm text-muted">
            EmojiQuick serves verified artwork from OpenMoji, Twemoji, Noto, and Fluent where license
            policy permits. Additional artwork styles are indexed in the master database.
          </p>
          <ul className="flex flex-wrap gap-2">
            {extraProviders.map((provider) => (
              <li key={provider} className="rounded-full bg-surface-muted px-3 py-1 text-sm">
                {PROVIDER_LABELS[provider]}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            See <Link href="/licenses" className="text-accent-strong underline">licenses &amp; attribution</Link> for provider terms.
          </p>
        </section>
      ) : null}
    </div>
  );
}
