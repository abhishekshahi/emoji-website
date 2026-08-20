import type { CompactEmojiEnrichmentRecord } from "./enrichment-compact-types";
import {
  compactCanonicalId,
  encodeVariantKind,
  groupRelatedLinks,
} from "./enrichment-compact-codecs";
import type { EmojiEnrichmentRecord } from "./enrichment-types";

export function compactEnrichmentRecord(
  slug: string,
  record: EmojiEnrichmentRecord,
): CompactEmojiEnrichmentRecord {
  const related = groupRelatedLinks(record.related);

  return {
    i: compactCanonicalId(record.canonicalId),
    o: record.officialName,
    ...(record.aliases.length > 0 ? { a: record.aliases } : {}),
    ...(record.searchTerms.length > 0 ? { t: record.searchTerms } : {}),
    ...(record.definitions.length > 0
      ? { d: record.definitions.map((definition) => definition.text) }
      : {}),
    w: record.artwork,
    ...(record.variantBaseSlug && record.variantBaseSlug !== slug
      ? { bs: record.variantBaseSlug }
      : {}),
    ...(record.variants.length > 0
      ? {
          v: record.variants.map(
            (variant) => [variant.slug, encodeVariantKind(variant.kind)] as const,
          ),
        }
      : {}),
    ...(related ? { r: related } : {}),
  };
}