import type { CanonicalEmojiRecord } from "../canonical/types";
import type { RawMetadataIndexRecord } from "../metadata/types";
import type {
  CanonicalKeywordEntry,
  CanonicalNameRecord,
  CanonicalSearchIndexEntry,
  CanonicalShortcodeEntry,
} from "./types";
import { isLikelyDefinition } from "./normalize";

export const PROPOSED_SEARCH_RANKING = {
  exactEmoji: 1000,
  exactUnicode: 900,
  exactHexcode: 880,
  exactCanonicalName: 700,
  exactShortcode: 600,
  exactAlias: 550,
  exactKeyword: 500,
  prefixName: 300,
  prefixKeyword: 200,
  semanticMatch: 100,
} as const;

function collectSemanticSearchTerms(records: RawMetadataIndexRecord[]): Array<{
  value: string;
  source: string;
  metadataRecordId: string;
}> {
  const terms: Array<{ value: string; source: string; metadataRecordId: string }> = [];
  const seen = new Set<string>();

  for (const record of records.filter((entry) => entry.recordType === "semantic")) {
    const keywords = record.fields.keywords.slice(0, 5);
    for (const keyword of keywords) {
      const normalized = keyword.trim().toLowerCase();
      if (!normalized || isLikelyDefinition(normalized) || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      terms.push({
        value: normalized,
        source: "emojinet",
        metadataRecordId: record.metadataRecordId,
      });
    }
  }

  return terms;
}

export function buildSearchIndexEntry(
  canonical: CanonicalEmojiRecord,
  nameRecord: CanonicalNameRecord,
  keywordEntry: CanonicalKeywordEntry,
  shortcodeEntry: CanonicalShortcodeEntry,
  records: RawMetadataIndexRecord[],
): CanonicalSearchIndexEntry {
  const semanticSearchTerms = collectSemanticSearchTerms(records);
  const unicodeSequence = canonical.unicodeSequence;
  const hexcode = unicodeSequence?.split("-")[0] ?? null;

  return {
    canonicalId: canonical.canonicalId,
    emoji: canonical.emoji,
    unicodeSequence,
    hexcode,
    canonicalName: nameRecord.canonicalName,
    aliases: nameRecord.aliases.map((alias) => alias.value),
    keywords: keywordEntry.normalizedKeywords,
    shortcodes: shortcodeEntry.shortcodes.map((entry) => entry.normalizedShortcode),
    sourceNames: nameRecord.sourceNames.map((entry) => entry.value),
    sourceKeywords: keywordEntry.sourceKeywords.flatMap((entry) => entry.keywords),
    semanticSearchTerms: semanticSearchTerms.map((entry) => entry.value),
    provenance: {
      canonicalName: {
        source: nameRecord.nameSource,
        rule: nameRecord.nameSelectionRule,
      },
      aliases: nameRecord.aliases.map((alias) => ({ value: alias.value, source: alias.source })),
      keywords: keywordEntry.canonicalKeywords.map((entry) => ({
        value: entry.value,
        sources: entry.sources,
      })),
      shortcodes: shortcodeEntry.shortcodes.map((entry) => ({
        value: entry.normalizedShortcode,
        source: entry.source,
        pack: entry.shortcodePack,
      })),
      semanticTerms: semanticSearchTerms,
    },
    proposedRankingModel: { ...PROPOSED_SEARCH_RANKING },
  };
}
