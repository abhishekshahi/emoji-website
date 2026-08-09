import type { CanonicalEmojiRecord } from "../canonical/types";
import type {
  MetadataKeywordIndexEntry,
  MetadataNameConflictEntry,
  RawMetadataIndexRecord,
  ShortcodeSourceIndexEntry,
} from "../metadata/types";
import { buildCanonicalKeywords } from "./keywords";
import { buildCanonicalNameRecord, classifyConflictGroup } from "./names";
import { buildCanonicalShortcodes } from "./shortcodes";
import { buildSearchIndexEntry } from "./search";
import { buildSeoConflicts, buildSeoRecord, resolveSeoSlugCollisions } from "./seo";
import type {
  CanonicalKeywordEntry,
  CanonicalNameRecord,
  CanonicalSearchIndexEntry,
  CanonicalSeoRecord,
  CanonicalShortcodeEntry,
  NameReconciliationConflictDetail,
  NameReconciliationReport,
  SeoConflictEntry,
} from "./types";

export interface BuildReconciliationInput {
  canonicalRecords: CanonicalEmojiRecord[];
  rawMetadataIndex: RawMetadataIndexRecord[];
  metadataNameConflicts: MetadataNameConflictEntry[];
  metadataKeywordIndex: MetadataKeywordIndexEntry[];
  shortcodeSourceIndex: ShortcodeSourceIndexEntry[];
}

export interface BuildReconciliationResult {
  canonicalNameRecords: CanonicalNameRecord[];
  canonicalKeywords: CanonicalKeywordEntry[];
  canonicalShortcodes: CanonicalShortcodeEntry[];
  canonicalSeoRecords: CanonicalSeoRecord[];
  canonicalSearchIndex: CanonicalSearchIndexEntry[];
  seoConflicts: SeoConflictEntry[];
  nameReconciliationReport: NameReconciliationReport;
}

function groupMetadataByCanonical(
  rawMetadataIndex: RawMetadataIndexRecord[],
): Map<string, RawMetadataIndexRecord[]> {
  const grouped = new Map<string, RawMetadataIndexRecord[]>();
  for (const record of rawMetadataIndex) {
    const bucket = grouped.get(record.canonicalId) ?? [];
    bucket.push(record);
    grouped.set(record.canonicalId, bucket);
  }
  return grouped;
}

function indexByCanonicalId<T extends { canonicalId: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.canonicalId, entry]));
}

export function buildReconciliationDatabase(input: BuildReconciliationInput): BuildReconciliationResult {
  const metadataByCanonical = groupMetadataByCanonical(input.rawMetadataIndex);
  const keywordByCanonical = indexByCanonicalId(input.metadataKeywordIndex);
  const shortcodeByCanonical = indexByCanonicalId(input.shortcodeSourceIndex);
  const originalConflictByCanonical = indexByCanonicalId(input.metadataNameConflicts);

  const canonicalNameRecords: CanonicalNameRecord[] = [];
  const canonicalKeywords: CanonicalKeywordEntry[] = [];
  const canonicalShortcodes: CanonicalShortcodeEntry[] = [];
  const canonicalSearchIndex: CanonicalSearchIndexEntry[] = [];
  const conflictDetails: NameReconciliationConflictDetail[] = [];

  for (const canonical of input.canonicalRecords) {
    const records = metadataByCanonical.get(canonical.canonicalId) ?? [];
    const nameRecord = buildCanonicalNameRecord(canonical, records);
    const keywordEntry = buildCanonicalKeywords(
      canonical.canonicalId,
      keywordByCanonical.get(canonical.canonicalId),
      records,
    );
    const shortcodeEntry = buildCanonicalShortcodes(
      canonical.canonicalId,
      shortcodeByCanonical.get(canonical.canonicalId),
    );

    canonicalNameRecords.push(nameRecord);
    canonicalKeywords.push(keywordEntry);
    canonicalShortcodes.push(shortcodeEntry);
    canonicalSearchIndex.push(
      buildSearchIndexEntry(canonical, nameRecord, keywordEntry, shortcodeEntry, records),
    );

    const original = originalConflictByCanonical.get(canonical.canonicalId);
    if (original || nameRecord.conflictCategory) {
      const sourceNames = Object.fromEntries(nameRecord.sourceNames.map((entry) => [entry.source, entry.value]));
      const category = nameRecord.conflictCategory ?? classifyConflictGroup(sourceNames);
      const resolution =
        category === "semantic-difference"
          ? nameRecord.aliases.length > 0
            ? "alias"
            : "unresolved"
          : nameRecord.aliases.length > 0
            ? "alias"
            : category === "exact-equivalent"
              ? "canonical-name"
              : "canonical-name";

      conflictDetails.push({
        canonicalId: canonical.canonicalId,
        originalClassification: original?.classification ?? null,
        category,
        resolution,
        canonicalName: nameRecord.canonicalName,
        sourceNames,
      });
    }
  }

  const canonicalSeoRecords = resolveSeoSlugCollisions(
    canonicalNameRecords.map((nameRecord) => {
      const keywordEntry = canonicalKeywords.find((entry) => entry.canonicalId === nameRecord.canonicalId)!;
      return buildSeoRecord(nameRecord, keywordEntry);
    }),
  );

  const seoConflicts = buildSeoConflicts(canonicalSeoRecords, canonicalNameRecords);

  const conflictClassification = {
    "exact-equivalent": 0,
    "punctuation-difference": 0,
    "capitalization-difference": 0,
    "singular-plural-difference": 0,
    "wording-difference": 0,
    synonym: 0,
    "regional-terminology": 0,
    "semantic-difference": 0,
    "source-specific-naming": 0,
  } satisfies Record<NameReconciliationConflictDetail["category"], number>;

  const resolutionCounts = {
    becameCanonicalNames: 0,
    becameAliases: 0,
    remainedSourceOnly: 0,
    remainedUnresolved: 0,
  };

  for (const detail of conflictDetails) {
    conflictClassification[detail.category] += 1;
    if (detail.resolution === "canonical-name") {
      resolutionCounts.becameCanonicalNames += 1;
    } else if (detail.resolution === "alias") {
      resolutionCounts.becameAliases += 1;
    } else if (detail.resolution === "source-only") {
      resolutionCounts.remainedSourceOnly += 1;
    } else {
      resolutionCounts.remainedUnresolved += 1;
    }
  }

  canonicalNameRecords.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  canonicalKeywords.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  canonicalShortcodes.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  canonicalSeoRecords.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  canonicalSearchIndex.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const nameReconciliationReport: NameReconciliationReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.7",
    ruleDocumentation: {
      unicodeNamePriority: [
        "1. unicode-emoji-data extracted official emoji-test name",
        "2. CLDR short name (unicode source bucket)",
        "3. OpenMoji annotation",
        "4. Emojibase label",
        "5. Emojilib name",
        "6. Fluent CLDR field",
        "7. EmojiNet metadata name",
        "8. Emoji Time utility name",
      ],
      sourceSpecificNamePriority: [
        "1. metadata source declared on canonical identity",
        "2. first available source metadata name",
        "3. derived fallback from canonicalId",
      ],
      aliasRules: [
        "Preserve all distinct source names as aliases when they differ from canonicalName",
        "Do not promote definitions, URLs, or long semantic sentences to aliases",
        "Alias provenance always includes source and metadataRecordId when available",
      ],
      keywordDedupRules: [
        "Remove only exact, case, punctuation, and whitespace duplicates",
        "Retain all source keyword sets separately in sourceKeywords",
        "Canonical keywords merge identical normalized forms with multi-source provenance",
      ],
      slugRules: [
        "Slugify canonicalName to lowercase hyphenated form",
        "On collision, append deterministic unicode suffix: fire-u1f525",
        "Never overwrite an existing slug owner",
      ],
    },
    baselines: {
      originalNameConflicts: input.metadataNameConflicts.length,
      canonicalIdentities: input.canonicalRecords.length,
    },
    conflictClassification,
    resolutionCounts,
    outputCounts: {
      canonicalNameRecords: canonicalNameRecords.length,
      totalAliases: canonicalNameRecords.reduce((sum, record) => sum + record.aliases.length, 0),
      canonicalKeywordEntries: canonicalKeywords.length,
      totalCanonicalKeywords: canonicalKeywords.reduce((sum, entry) => sum + entry.canonicalKeywords.length, 0),
      canonicalShortcodeEntries: canonicalShortcodes.filter((entry) => entry.shortcodes.length > 0).length,
      totalShortcodeRecords: canonicalShortcodes.reduce((sum, entry) => sum + entry.shortcodes.length, 0),
      seoRecords: canonicalSeoRecords.length,
      seoConflicts: seoConflicts.length,
      searchIndexEntries: canonicalSearchIndex.length,
    },
    constraints: {
      allSourceMetadataPreserved: true,
      noRawDataModified: true,
      noArtworkModified: true,
      noCanonicalIdentitiesModified: true,
      productionDataUnchanged: true,
    },
    note: "Proposed canonical metadata layer. Not connected to production search or SEO.",
    conflictDetails,
  };

  return {
    canonicalNameRecords,
    canonicalKeywords,
    canonicalShortcodes,
    canonicalSeoRecords,
    canonicalSearchIndex,
    seoConflicts,
    nameReconciliationReport,
  };
}
