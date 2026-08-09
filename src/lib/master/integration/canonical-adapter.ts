import { getMasterReader } from "./master-reader";
import type { MasterCanonicalLookup, ProvenanceValue } from "./types";

function provenance<T>(value: T, source: string, canonicalId: string): ProvenanceValue<T> {
  return Object.freeze({ value, source, canonicalId });
}

export function getCanonicalEmoji(canonicalId: string, rootDir?: string): MasterCanonicalLookup | null {
  const reader = getMasterReader(rootDir);
  const identity = reader.canonicalRecords.get(canonicalId);
  if (!identity) {
    return null;
  }

  const nameRecord = reader.nameRecords.get(canonicalId);
  const seoRecord = reader.seoRecords.get(canonicalId) ?? null;
  const semanticIndex = reader.semanticIndex.get(canonicalId) ?? null;

  const aliases: ProvenanceValue<string>[] = (nameRecord?.aliases ?? []).map((alias) =>
    provenance(alias.value, alias.source, canonicalId),
  );

  const keywords: ProvenanceValue<string>[] = [];
  for (const entry of semanticIndex?.safeSearchTerms ?? []) {
    if (entry.classification !== "inappropriate-public-seo") {
      keywords.push(provenance(entry.term, entry.source, canonicalId));
    }
  }

  const shortcodes: ProvenanceValue<string>[] = [];
  const searchEntry = reader.searchIndex.get(canonicalId);
  if (searchEntry) {
    for (const shortcode of searchEntry.shortcodes) {
      shortcodes.push(provenance(shortcode, "canonical-shortcodes", canonicalId));
    }
    for (const keyword of searchEntry.keywords) {
      if (!keywords.some((entry) => entry.value === keyword)) {
        keywords.push(provenance(keyword, "canonical-keywords", canonicalId));
      }
    }
  }

  const safeSearchTerms: ProvenanceValue<string>[] = (semanticIndex?.safeSearchTerms ?? []).map((term) =>
    provenance(term.term, term.source, canonicalId),
  );

  return Object.freeze({
    canonicalId,
    identity,
    canonicalName: nameRecord
      ? provenance(nameRecord.canonicalName, nameRecord.nameSource, canonicalId)
      : null,
    aliases: Object.freeze(aliases),
    keywords: Object.freeze(keywords),
    shortcodes: Object.freeze(shortcodes),
    safeSearchTerms: Object.freeze(safeSearchTerms),
    seoRecord,
    semanticIndex,
  });
}
