import type { CanonicalEmojiRecord } from "../canonical/types";
import type { RawMetadataIndexRecord } from "../metadata/types";
import type { CanonicalKeywordEntry, CanonicalNameRecord } from "../reconciliation/types";
import type { NameReconciliationReport } from "../reconciliation/types";
import { normalizeForComparison, normalizeKeyword } from "../reconciliation/normalize";
import { auditAlias, buildGlobalAliasCounts, collectKeywordTerms } from "./aliases";
import {
  buildSemanticSourceRecord,
  classifySemanticTerm,
  isPublicSearchSafe,
  isPublicSeoSafe,
} from "./classify";
import type {
  AliasAuditEntry,
  CanonicalSemanticIndexEntry,
  SemanticConflictEntry,
  SemanticCoverageEntry,
  SemanticCoverageReport,
  SemanticDefinitionEntry,
  SemanticDifferenceAuditEntry,
  SemanticSearchTermEntry,
  SemanticSeoPolicyReport,
  SemanticSourceRecord,
  SemanticTermProvenance,
} from "./types";

export interface BuildSemanticLayerInput {
  canonicalRecords: CanonicalEmojiRecord[];
  rawMetadataIndex: RawMetadataIndexRecord[];
  canonicalNameRecords: CanonicalNameRecord[];
  canonicalKeywords: CanonicalKeywordEntry[];
  nameReconciliationReport: NameReconciliationReport;
}

export interface BuildSemanticLayerResult {
  semanticSourceIndex: SemanticSourceRecord[];
  canonicalSemanticIndex: CanonicalSemanticIndexEntry[];
  canonicalSemanticSearch: CanonicalSemanticIndexEntry[];
  semanticSeoIndex: CanonicalSemanticIndexEntry[];
  semanticSearchTerms: SemanticSearchTermEntry[];
  semanticDefinitionsIndex: SemanticDefinitionEntry[];
  semanticConflicts: SemanticConflictEntry[];
  semanticCoverageReport: SemanticCoverageReport;
  semanticSeoPolicyReport: SemanticSeoPolicyReport;
}

function groupByCanonical<T extends { canonicalId: string }>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    const bucket = map.get(entry.canonicalId) ?? [];
    bucket.push(entry);
    map.set(entry.canonicalId, bucket);
  }
  return map;
}

function buildGlobalTermCounts(
  keywordEntries: CanonicalKeywordEntry[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of keywordEntries) {
    for (const keyword of entry.canonicalKeywords) {
      const key = normalizeForComparison(keyword.value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function dedupeProvenance(terms: SemanticTermProvenance[]): SemanticTermProvenance[] {
  const seen = new Set<string>();
  const result: SemanticTermProvenance[] = [];
  for (const term of terms) {
    const key = `${term.normalizedTerm}:${term.source}:${term.sourceRecord}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(term);
  }
  return result.sort((left, right) => left.normalizedTerm.localeCompare(right.normalizedTerm));
}

export function buildSemanticLayer(input: BuildSemanticLayerInput): BuildSemanticLayerResult {
  const metadataByCanonical = groupByCanonical(input.rawMetadataIndex);
  const keywordsByCanonical = new Map(input.canonicalKeywords.map((entry) => [entry.canonicalId, entry]));
  const namesByCanonical = new Map(input.canonicalNameRecords.map((entry) => [entry.canonicalId, entry]));
  const globalTermCounts = buildGlobalTermCounts(input.canonicalKeywords);
  const globalAliasCounts = buildGlobalAliasCounts(input.canonicalNameRecords);

  const semanticSourceIndex = input.rawMetadataIndex
    .filter((record) => record.recordType === "semantic")
    .map(buildSemanticSourceRecord);

  const semanticDefinitionsIndex: SemanticDefinitionEntry[] = input.rawMetadataIndex
    .filter((record) => record.fields.definition)
    .map((record) => ({
      canonicalId: record.canonicalId,
      source: record.source,
      sourceVersion: record.sourceVersion,
      metadataRecordId: record.metadataRecordId,
      definition: record.fields.definition!,
      senseId: record.sourceId.includes(":sense:") ? record.sourceId.split(":sense:")[1] ?? null : null,
      partOfSpeech: typeof record.rawMetadata.partOfSpeech === "string" ? record.rawMetadata.partOfSpeech : null,
      babelNetId: typeof record.rawMetadata.babelNetId === "string" ? record.rawMetadata.babelNetId : null,
      name: record.fields.name ?? record.rawName,
      rawRecordRef: record.rawRecordRef,
    }));

  const canonicalSemanticIndex: CanonicalSemanticIndexEntry[] = [];
  const semanticConflicts: SemanticConflictEntry[] = [];
  const globalSearchTermMap = new Map<string, SemanticSearchTermEntry>();

  let totalSemanticTerms = 0;
  let safeSearchCount = 0;
  let safeSeoCount = 0;
  let searchOnlyCount = 0;
  let sourceOnlyCount = 0;
  let ambiguousCount = 0;
  let rejectedSeoCount = 0;
  let unresolvedCount = 0;

  const semanticDifferenceAudits: SemanticDifferenceAuditEntry[] = [];

  for (const canonical of input.canonicalRecords) {
    const records = metadataByCanonical.get(canonical.canonicalId) ?? [];
    const nameRecord = namesByCanonical.get(canonical.canonicalId);
    const keywordEntry = keywordsByCanonical.get(canonical.canonicalId);
    const canonicalName = nameRecord?.canonicalName ?? canonical.canonicalId;

    const aliasAudits: AliasAuditEntry[] =
      nameRecord?.aliases.map((alias) => auditAlias(alias, canonicalName, globalAliasCounts)) ?? [];

    const keywordTerms = collectKeywordTerms(keywordEntry, records);
    const sourceSemantics: SemanticTermProvenance[] = [];
    const safeSearchTerms: SemanticTermProvenance[] = [];
    const safeSeoTerms: SemanticTermProvenance[] = [];
    const sourceOnlyTerms: SemanticTermProvenance[] = [];
    const ambiguousTerms: SemanticTermProvenance[] = [];

    for (const item of keywordTerms) {
      const globalIdentityCount = globalTermCounts.get(normalizeForComparison(item.term)) ?? 1;
      const { classification, reason } = classifySemanticTerm({
        term: item.term,
        source: item.source,
        canonicalName,
        isDefinition: false,
        isSenseKeyword: item.isSenseKeyword,
        isTag: item.isTag,
        isEmojiTime: item.source === "emojiTime",
        isSourceSpecificIdentity: !canonical.isUnicode,
        globalIdentityCount,
      });

      const provenance: SemanticTermProvenance = {
        term: item.term,
        normalizedTerm: normalizeKeyword(item.term),
        canonicalId: canonical.canonicalId,
        source: item.source,
        sourceRecord: item.sourceRecord,
        sourceVersion: item.sourceVersion,
        originalValue: item.term,
        classification,
        publicSearch: isPublicSearchSafe(classification),
        publicSeo: isPublicSeoSafe(classification),
        reason,
      };

      totalSemanticTerms += 1;
      sourceSemantics.push(provenance);

      if (provenance.publicSearch) {
        safeSearchTerms.push(provenance);
      } else if (classification === "potentially-confusing") {
        ambiguousTerms.push(provenance);
      } else if (classification === "inappropriate-public-seo") {
        sourceOnlyTerms.push(provenance);
        rejectedSeoCount += 1;
      } else if (
        classification === "related-concept" ||
        classification === "contextual-association" ||
        classification === "common-alternate-term"
      ) {
        sourceOnlyTerms.push(provenance);
      } else if (classification === "unresolved") {
        sourceOnlyTerms.push(provenance);
      } else {
        sourceOnlyTerms.push(provenance);
      }

      if (provenance.publicSeo) {
        safeSeoTerms.push(provenance);
      }

      const searchKey = provenance.normalizedTerm;
      const existing = globalSearchTermMap.get(searchKey);
      if (!existing) {
        globalSearchTermMap.set(searchKey, {
          term: provenance.term,
          normalizedTerm: provenance.normalizedTerm,
          canonicalIds: [canonical.canonicalId],
          termType: provenance.publicSearch ? "keyword" : provenance.classification === "potentially-confusing" ? "ambiguous" : "semantic",
          sourceCount: 1,
          confidence: provenance.publicSearch ? 0.9 : 0.5,
          ambiguous: globalIdentityCount >= 8,
          publicSearch: provenance.publicSearch,
          sources: [provenance.source],
        });
      } else {
        if (!existing.canonicalIds.includes(canonical.canonicalId)) {
          existing.canonicalIds.push(canonical.canonicalId);
        }
        if (!existing.sources.includes(provenance.source)) {
          existing.sources.push(provenance.source);
        }
        existing.sourceCount = existing.sources.length;
        existing.ambiguous = existing.canonicalIds.length >= 8;
        existing.publicSearch = existing.publicSearch && provenance.publicSearch && !existing.ambiguous;
        existing.termType = existing.ambiguous ? "ambiguous" : existing.termType;
        existing.confidence = existing.ambiguous ? 0.3 : existing.confidence;
      }
    }

    const semanticDiff = input.nameReconciliationReport.conflictDetails.find(
      (detail) => detail.canonicalId === canonical.canonicalId && detail.category === "semantic-difference",
    );

    let semanticDifferenceAudit: SemanticDifferenceAuditEntry | null = null;
    if (semanticDiff) {
      semanticDifferenceAudit = {
        canonicalId: canonical.canonicalId,
        canonicalName,
        originalClassification: semanticDiff.originalClassification,
        sourceValues: semanticDiff.sourceNames,
        publicSearchStatus: "source-only",
        publicSeoStatus: "source-only",
        reason: "semantic-difference-conflict-not-auto-exposed",
      };
      semanticDifferenceAudits.push(semanticDifferenceAudit);

      semanticConflicts.push({
        canonicalId: canonical.canonicalId,
        kind: "semantic-disagreement",
        term: canonicalName,
        sources: Object.keys(semanticDiff.sourceNames),
        detail: "Phase 8.7 semantic-difference conflict audited; source values preserved, not auto-promoted to public aliases.",
      });
    }

    canonicalSemanticIndex.push({
      canonicalId: canonical.canonicalId,
      isUnicode: canonical.isUnicode,
      identityType: canonical.identityType,
      canonicalName,
      sourceSemantics: dedupeProvenance(sourceSemantics),
      safeSearchTerms: dedupeProvenance(safeSearchTerms),
      safeSeoTerms: dedupeProvenance(safeSeoTerms),
      sourceOnlyTerms: dedupeProvenance(sourceOnlyTerms),
      ambiguousTerms: dedupeProvenance(ambiguousTerms),
      aliasAudits,
      semanticDifferenceAudit,
    });
  }

  const semanticSearchTerms = [...globalSearchTermMap.values()].sort((left, right) =>
    left.normalizedTerm.localeCompare(right.normalizedTerm),
  );

  const coverageEntries: SemanticCoverageEntry[] = input.canonicalRecords.map((canonical) => {
    const records = metadataByCanonical.get(canonical.canonicalId) ?? [];
    const senses = records.filter((record) => record.recordType === "semantic").length;
    const definitions = records.filter((record) => record.fields.definition).length;
    const sources = new Set(records.map((record) => record.source));
    return {
      canonicalId: canonical.canonicalId,
      hasSemanticData: senses > 0 || definitions > 0 || records.some((record) => record.fields.keywords.length > 0),
      emojinet: sources.has("emojinet"),
      emojilib: sources.has("emojilib"),
      emojibase: sources.has("emojibase"),
      openmoji: sources.has("openmoji"),
      cldr: sources.has("unicode"),
      unicode: sources.has("unicode-emoji-data"),
      fluent: sources.has("fluent"),
      emojiTime: sources.has("emoji-time"),
      senseCount: senses,
      definitionCount: definitions,
    };
  });

  const safeAliasCount = canonicalSemanticIndex.reduce(
    (sum, entry) => sum + entry.aliasAudits.filter((audit) => audit.publicAlias).length,
    0,
  );
  const restrictedAliasCount = canonicalSemanticIndex.reduce(
    (sum, entry) => sum + entry.aliasAudits.filter((audit) => !audit.publicAlias).length,
    0,
  );
  safeSearchCount = canonicalSemanticIndex.reduce((sum, entry) => sum + entry.safeSearchTerms.length, 0);
  safeSeoCount = canonicalSemanticIndex.reduce((sum, entry) => sum + entry.safeSeoTerms.length, 0);
  sourceOnlyCount = canonicalSemanticIndex.reduce((sum, entry) => sum + entry.sourceOnlyTerms.length, 0);
  ambiguousCount = canonicalSemanticIndex.reduce((sum, entry) => sum + entry.ambiguousTerms.length, 0);
  searchOnlyCount = sourceOnlyCount;
  unresolvedCount = canonicalSemanticIndex.reduce(
    (sum, entry) => sum + entry.sourceOnlyTerms.filter((term) => term.classification === "unresolved").length,
    0,
  );
  rejectedSeoCount = canonicalSemanticIndex.reduce(
    (sum, entry) =>
      sum +
      entry.sourceSemantics.filter(
        (term) => term.classification === "inappropriate-public-seo" || (!term.publicSeo && !term.publicSearch),
      ).length,
    0,
  );

  const semanticCoverageReport: SemanticCoverageReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.8",
    totals: {
      canonicalIdentities: input.canonicalRecords.length,
      withSemanticData: coverageEntries.filter((entry) => entry.hasSemanticData).length,
      withoutSemanticData: coverageEntries.filter((entry) => !entry.hasSemanticData).length,
      emojinetSenses: input.rawMetadataIndex.filter((record) => record.recordType === "semantic").length,
      emojinetDefinitions: semanticDefinitionsIndex.length,
      emojinetCoverage: coverageEntries.filter((entry) => entry.emojinet).length,
      emojilibCoverage: coverageEntries.filter((entry) => entry.emojilib).length,
      emojibaseCoverage: coverageEntries.filter((entry) => entry.emojibase).length,
      openmojiCoverage: coverageEntries.filter((entry) => entry.openmoji).length,
      cldrCoverage: coverageEntries.filter((entry) => entry.cldr).length,
      unicodeCoverage: coverageEntries.filter((entry) => entry.unicode).length,
      fluentCoverage: coverageEntries.filter((entry) => entry.fluent).length,
      emojiTimeCoverage: coverageEntries.filter((entry) => entry.emojiTime).length,
    },
    entries: coverageEntries,
  };

  const semanticSeoPolicyReport: SemanticSeoPolicyReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.8",
    counts: {
      totalSemanticTerms,
      safeSearchTerms: safeSearchCount,
      safeSeoTerms: safeSeoCount,
      searchOnlyTerms: searchOnlyCount,
      sourceOnlyTerms: sourceOnlyCount,
      ambiguousTerms: ambiguousCount,
      rejectedPublicSeoTerms: rejectedSeoCount,
      unresolvedTerms: unresolvedCount,
      semanticDifferenceConflicts: semanticDifferenceAudits.length,
      aliasAudits: safeAliasCount + restrictedAliasCount,
      safeAliases: safeAliasCount,
      restrictedAliases: restrictedAliasCount,
    },
    preservation: {
      emojinetSenses: input.rawMetadataIndex.filter((record) => record.recordType === "semantic").length,
      emojinetDefinitions: semanticDefinitionsIndex.length,
      allEmojilibKeywordsPreserved: true,
      allEmojibaseTagsPreserved: true,
      allSourceNamesPreserved: true,
      allSourceAliasesPreserved: true,
      allSourceShortcodesPreserved: true,
    },
    constraints: {
      allSourceSemanticsPreserved: true,
      noRawDataModified: true,
      noArtworkModified: true,
      noCanonicalIdentitiesModified: true,
      productionDataUnchanged: true,
    },
    note: "Semantic enrichment layer. Not connected to production search or SEO.",
  };

  canonicalSemanticIndex.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  return {
    semanticSourceIndex,
    canonicalSemanticIndex,
    canonicalSemanticSearch: canonicalSemanticIndex.map((entry) => ({
      ...entry,
      sourceSemantics: entry.sourceSemantics,
      safeSearchTerms: entry.safeSearchTerms,
      safeSeoTerms: [],
      sourceOnlyTerms: [...entry.sourceOnlyTerms, ...entry.safeSeoTerms.filter((term) => !term.publicSeo)],
      ambiguousTerms: entry.ambiguousTerms,
    })),
    semanticSeoIndex: canonicalSemanticIndex.map((entry) => ({
      ...entry,
      sourceSemantics: entry.sourceSemantics,
      safeSearchTerms: [],
      safeSeoTerms: entry.safeSeoTerms,
      sourceOnlyTerms: [...entry.sourceOnlyTerms, ...entry.safeSearchTerms],
      ambiguousTerms: entry.ambiguousTerms,
    })),
    semanticSearchTerms,
    semanticDefinitionsIndex,
    semanticConflicts: semanticConflicts.sort((left, right) =>
      `${left.canonicalId}:${left.term}`.localeCompare(`${right.canonicalId}:${right.term}`),
    ),
    semanticCoverageReport,
    semanticSeoPolicyReport,
  };
}
