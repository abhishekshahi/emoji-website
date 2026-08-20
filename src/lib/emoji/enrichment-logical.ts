import type { EmojiEnrichmentRecord } from "./enrichment-types";

export interface LogicalEnrichment {
  readonly canonicalId: string;
  readonly officialName: string | null;
  readonly aliases: readonly string[];
  readonly searchTerms: readonly string[];
  readonly definitions: readonly { readonly text: string; readonly source: string }[];
  readonly artworkProviders: readonly string[];
  readonly artworkPrimary: string;
  readonly artworkCount: number;
  readonly variantBaseSlug: string | null;
  readonly variants: readonly { readonly slug: string; readonly kind: string }[];
  readonly related: readonly { readonly slug: string; readonly reason: string }[];
}

export function toLogicalEnrichment(record: EmojiEnrichmentRecord): LogicalEnrichment {
  return {
    canonicalId: record.canonicalId,
    officialName: record.officialName,
    aliases: [...record.aliases].sort(),
    searchTerms: [...record.searchTerms],
    definitions: record.definitions.map((definition) => ({
      text: definition.text,
      source: definition.source,
    })),
    artworkProviders: Object.keys(record.artwork.p).sort(),
    artworkPrimary: record.artwork.primary,
    artworkCount: record.artwork.count,
    variantBaseSlug: record.variantBaseSlug,
    variants: record.variants.map((variant) => ({
      slug: variant.slug,
      kind: variant.kind,
    })),
    related: record.related.map((link) => ({
      slug: link.slug,
      reason: link.reason,
    })),
  };
}

export function logicalEnrichmentEquals(
  left: LogicalEnrichment,
  right: LogicalEnrichment,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}