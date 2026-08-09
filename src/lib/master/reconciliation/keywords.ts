import type { MetadataKeywordIndexEntry } from "../metadata/types";
import type { RawMetadataIndexRecord } from "../metadata/types";
import type { CanonicalKeywordEntry, SourceKeywordSet } from "./types";
import { keywordDedupKey, normalizeKeyword } from "./normalize";
import { sourceBucketLabel } from "./names";

function collectSourceKeywordSets(
  keywordEntry: MetadataKeywordIndexEntry | undefined,
  records: RawMetadataIndexRecord[],
): SourceKeywordSet[] {
  const sets = new Map<string, SourceKeywordSet>();

  if (keywordEntry) {
    for (const [source, keywords] of Object.entries(keywordEntry.keywords)) {
      sets.set(source, {
        source,
        keywords: [...keywords],
        metadataRecordIds: [],
      });
    }
  }

  for (const record of records) {
    const source = sourceBucketLabel(record.source);
    const keywords = [...new Set([...record.fields.keywords, ...record.fields.tags])].filter(Boolean);
    if (keywords.length === 0) {
      continue;
    }

    const existing = sets.get(source) ?? { source, keywords: [], metadataRecordIds: [] };
    existing.keywords = [...new Set([...existing.keywords, ...keywords])];
    existing.metadataRecordIds.push(record.metadataRecordId);
    sets.set(source, existing);
  }

  return [...sets.values()]
    .map((entry) => ({
      ...entry,
      keywords: entry.keywords.sort(),
      metadataRecordIds: [...new Set(entry.metadataRecordIds)].sort(),
    }))
    .sort((left, right) => left.source.localeCompare(right.source));
}

export function buildCanonicalKeywords(
  canonicalId: string,
  keywordEntry: MetadataKeywordIndexEntry | undefined,
  records: RawMetadataIndexRecord[],
): CanonicalKeywordEntry {
  const sourceKeywords = collectSourceKeywordSets(keywordEntry, records);
  const canonicalKeywords: CanonicalKeywordEntry["canonicalKeywords"] = [];
  const normalizedSet = new Set<string>();
  const normalizedKeywords: string[] = [];

  for (const sourceSet of sourceKeywords) {
    for (const keyword of sourceSet.keywords) {
      const normalized = normalizeKeyword(keyword);
      const dedupKey = keywordDedupKey(keyword);
      if (!normalized || !dedupKey) {
        continue;
      }

      const existing = canonicalKeywords.find((entry) => keywordDedupKey(entry.value) === dedupKey);
      if (existing) {
        if (!existing.sources.includes(sourceSet.source)) {
          existing.sources.push(sourceSet.source);
          existing.sources.sort();
          existing.reason = "merged-duplicate-across-sources";
        }
        continue;
      }

      canonicalKeywords.push({
        value: normalized,
        sources: [sourceSet.source],
        reason: "source-keyword",
      });
      if (!normalizedSet.has(dedupKey)) {
        normalizedSet.add(dedupKey);
        normalizedKeywords.push(normalized);
      }
    }
  }

  canonicalKeywords.sort((left, right) => left.value.localeCompare(right.value));
  normalizedKeywords.sort();

  return {
    canonicalId,
    canonicalKeywords,
    sourceKeywords,
    normalizedKeywords,
  };
}
