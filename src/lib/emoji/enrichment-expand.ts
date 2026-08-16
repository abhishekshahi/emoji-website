import type {
  CompactEmojiEnrichmentRecord,
  EmojiEnrichmentCompactFile,
} from "./enrichment-compact-types";
import {
  decodeVariantKind,
  expandCanonicalId,
  expandRelatedGrouped,
} from "./enrichment-compact-codecs";
import type { EmojiEnrichmentFile, EmojiEnrichmentRecord } from "./enrichment-types";
import { filterPublicDefinitions } from "@/lib/master/public/asset-rights";
import { buildVariantLabel, sortVariantLinks } from "./variant-intelligence";
import type { BrowsableEmoji } from "./types";

export function expandCompactRecord(
  slug: string,
  compact: CompactEmojiEnrichmentRecord,
  source: BrowsableEmoji,
  resolveEmoji: (targetSlug: string) => BrowsableEmoji | undefined,
): EmojiEnrichmentRecord {
  const variants = sortVariantLinks(
    (compact.v ?? []).map(([variantSlug, kindCode]) => {
      const target = resolveEmoji(variantSlug);
      return {
        slug: variantSlug,
        kind: decodeVariantKind(kindCode),
        label: target ? buildVariantLabel(source, target) : variantSlug,
      };
    }),
  );

  const definitions = filterPublicDefinitions(
    (compact.d ?? []).map((text) => ({ text, source: "unicode" })),
  );

  return Object.freeze({
    canonicalId: expandCanonicalId(compact.i),
    officialName: compact.o,
    aliases: Object.freeze(compact.a ?? []),
    searchTerms: Object.freeze(compact.t ?? []),
    definitions: Object.freeze(definitions),
    artwork: Object.freeze(compact.w),
    variantBaseSlug: compact.bs ?? slug,
    variants: Object.freeze(variants),
    related: Object.freeze(expandRelatedGrouped(compact.r ?? {})),
  });
}

export function expandCompactEnrichmentFile(
  file: EmojiEnrichmentCompactFile,
  resolveEmoji: (slug: string) => BrowsableEmoji | undefined,
): EmojiEnrichmentFile {
  const bySlug: Record<string, EmojiEnrichmentRecord> = {};

  for (const [slug, compact] of Object.entries(file.bySlug)) {
    const source = resolveEmoji(slug);
    if (!source) {
      continue;
    }
    bySlug[slug] = expandCompactRecord(slug, compact, source, resolveEmoji);
  }

  return {
    generatedAt: file.generatedAt,
    releaseId: file.releaseId,
    recordCount: file.recordCount,
    bySlug,
  };
}