import { getMasterReader } from "../master-reader";
import { getMetadata } from "../metadata-adapter";
import { getDefinitionIndex, getKeywordIndex, getShortcodeIndex } from "./lazy-data";
import { getSourceMetadataAvailability } from "./sources";
import type {
  AliasProvenance,
  EnrichedMetadataLookup,
  ShortcodeProvenance,
  SourceKeywordProvenance,
} from "./types";

export function getEnrichedMetadata(canonicalId: string, rootDir?: string): EnrichedMetadataLookup | null {
  const base = getMetadata(canonicalId, rootDir);
  if (!base) {
    return null;
  }

  const reader = getMasterReader(rootDir);
  const keywordEntry = getKeywordIndex(rootDir).get(canonicalId);
  const shortcodeEntry = getShortcodeIndex(rootDir).get(canonicalId);
  const semanticEntry = reader.semanticIndex.get(canonicalId);
  const definitions = getDefinitionIndex(rootDir).get(canonicalId) ?? [];

  const sourceKeywords: SourceKeywordProvenance[] = (keywordEntry?.sourceKeywords ?? []).flatMap((set) =>
    set.keywords.map((value) =>
      Object.freeze({
        value,
        sources: Object.freeze([set.source]),
        reason: "source-keyword",
      }),
    ),
  );

  const canonicalKeywords: SourceKeywordProvenance[] = (keywordEntry?.canonicalKeywords ?? []).map((entry) =>
    Object.freeze({
      value: entry.value,
      sources: Object.freeze([...entry.sources]),
      reason: entry.reason,
    }),
  );

  const shortcodeRecords: ShortcodeProvenance[] = (shortcodeEntry?.shortcodes ?? []).map((entry) =>
    Object.freeze({
      shortcode: entry.shortcode,
      normalizedShortcode: entry.normalizedShortcode,
      source: entry.source,
      shortcodePack: entry.shortcodePack,
      status: entry.status,
    }),
  );

  const safeAliases: AliasProvenance[] = [];
  const restrictedAliases: AliasProvenance[] = [];
  for (const audit of semanticEntry?.aliasAudits ?? []) {
    const item = Object.freeze({
      value: audit.value,
      source: audit.source,
      type: audit.type,
      classification: audit.classification,
      publicAlias: audit.publicAlias,
      reason: audit.reason,
    });
    if (audit.publicAlias) {
      safeAliases.push(item);
    } else {
      restrictedAliases.push(item);
    }
  }

  return Object.freeze({
    ...base,
    sourceKeywords: Object.freeze(sourceKeywords),
    canonicalKeywords: Object.freeze(canonicalKeywords),
    shortcodeRecords: Object.freeze(shortcodeRecords),
    safeAliases: Object.freeze(safeAliases),
    restrictedAliases: Object.freeze(restrictedAliases),
    emojinetDefinitions: Object.freeze(definitions.map((entry) => Object.freeze(entry))),
    emojinetSenseCount: semanticEntry?.sourceSemantics.filter((term) => term.source === "emojinet").length ?? 0,
    sourceAvailability: getSourceMetadataAvailability(canonicalId, rootDir),
  });
}
