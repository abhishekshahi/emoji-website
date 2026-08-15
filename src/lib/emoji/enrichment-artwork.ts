import type { EmojiEnrichmentRecord, EnrichmentArtworkProvider } from "./enrichment-types";

export function getEnrichmentArtworkProviders(
  record: Pick<EmojiEnrichmentRecord, "artwork">,
): EnrichmentArtworkProvider[] {
  return Object.keys(record.artwork.p) as EnrichmentArtworkProvider[];
}

export function hasEnrichmentArtworkProvider(
  record: Pick<EmojiEnrichmentRecord, "artwork">,
  provider: EnrichmentArtworkProvider,
): boolean {
  return Boolean(record.artwork.p[provider]);
}
