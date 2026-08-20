import "server-only";

import compactFile from "@/data/emoji-enrichment.json";
import { getBrowsableEmojiBySlug } from "./browsable-data";
import { parseEmojiEnrichmentCompactFile, type EmojiEnrichmentCompactFile } from "./enrichment-compact-types";
import { expandCompactRecord } from "./enrichment-expand";
import type { EmojiEnrichmentRecord } from "./enrichment-types";

const enrichment = parseEmojiEnrichmentCompactFile(compactFile);
const expandedCache = new Map<string, EmojiEnrichmentRecord>();

export function getEmojiEnrichmentBySlug(slug: string): EmojiEnrichmentRecord | null {
  const compact = enrichment.bySlug[slug];
  if (!compact) {
    return null;
  }

  const cached = expandedCache.get(slug);
  if (cached) {
    return cached;
  }

  const source = getBrowsableEmojiBySlug(slug);
  if (!source) {
    return null;
  }

  const expanded = expandCompactRecord(slug, compact, source, getBrowsableEmojiBySlug);
  expandedCache.set(slug, expanded);
  return expanded;
}

export function getEmojiEnrichmentStats(): Pick<
  EmojiEnrichmentCompactFile,
  "generatedAt" | "releaseId" | "recordCount"
> {
  return {
    generatedAt: enrichment.generatedAt,
    releaseId: enrichment.releaseId,
    recordCount: enrichment.recordCount,
  };
}
export function getEmojiVariants(slug: string): EmojiEnrichmentRecord["variants"] {
  return getEmojiEnrichmentBySlug(slug)?.variants ?? [];
}

export function getEmojiRelated(slug: string): EmojiEnrichmentRecord["related"] {
  return getEmojiEnrichmentBySlug(slug)?.related ?? [];
}

export function getEmojiArtwork(slug: string): EmojiEnrichmentRecord["artwork"] | null {
  return getEmojiEnrichmentBySlug(slug)?.artwork ?? null;
}

export function getEmojiDefinitions(slug: string): EmojiEnrichmentRecord["definitions"] {
  return getEmojiEnrichmentBySlug(slug)?.definitions ?? [];
}

export function getEmojiSearchTerms(slug: string): EmojiEnrichmentRecord["searchTerms"] {
  return getEmojiEnrichmentBySlug(slug)?.searchTerms ?? [];
}