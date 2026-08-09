import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ArtworkIdentityMapping,
  CanonicalSourceRef,
  EmojiNetIdentityReport,
  EmojiTimeIdentityMapping,
  IdentityAuditReport,
  IdentityConflict,
  MetadataIdentityMapping,
  RawIdentityMapping,
} from "../../src/lib/master/identity/types";
import { buildConflictReport } from "../../src/lib/master/identity/conflicts";
import {
  buildFluentMetadataIndex,
  identityCategoryForArtwork,
  isUnicodeIdentity,
  resolveArtworkIdentity,
  resolveMetadataIdentity,
  resolveRawRecordIdentity,
} from "../../src/lib/master/identity/resolve";
import { buildPrivateUseAudit } from "../../src/lib/master/identity/private-use-audit";
import { buildUnmatchedClassification } from "../../src/lib/master/identity/unmatched";
import { buildVariationSelectorAudit } from "../../src/lib/master/identity/variation-selector";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const rawDir = join(rootDir, "src", "data", "master", "raw");
const identityDir = join(rootDir, "src", "data", "master", "identity");
const ORIGINAL_CONFLICT_COUNT = 5531;

interface RawSourceRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  rawName: string;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawArtworkReference: string | null;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  recordType: string;
}

interface RawArtworkRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  stagedPath: string;
  originalPath: string;
  format: string;
  variant: string | null;
  rawLicense: string;
  sourceURL: string;
  checksum: string | null;
}

interface RawMetadataRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  rawName: string | null;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  recordType: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function verifyFileUnchanged(path: string, expectedCount?: number): number {
  const data = readJson<unknown[]>(path);
  if (expectedCount !== undefined && data.length !== expectedCount) {
    throw new Error(`Production file changed: ${path} expected ${expectedCount}, got ${data.length}`);
  }
  return data.length;
}

function main(): void {
  const sourceRecords = readJson<RawSourceRecord[]>(join(rawDir, "raw-source-records.json"));
  const artworkRecords = readJson<RawArtworkRecord[]>(join(rawDir, "raw-artwork-records.json"));
  const metadataRecords = readJson<RawMetadataRecord[]>(join(rawDir, "raw-metadata-records.json"));

  const standardCount = verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  const extrasCount = verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);

  const fluentMetadataIndex = buildFluentMetadataIndex(
    metadataRecords.filter((record) => record.source === "fluent"),
  );

  const rawToCanonical: RawIdentityMapping[] = [];
  const conflicts: IdentityConflict[] = [];
  const sourceIdentityByKey = new Map<string, string>();
  let fluentRecordsCorrected = 0;
  let fluentRecordsUnresolved = 0;

  for (const record of sourceRecords) {
    const { resolution, conflicts: recordConflicts } = resolveRawRecordIdentity(
      {
        source: record.source,
        sourceId: record.sourceId,
        rawEmoji: record.rawEmoji,
        rawCodepoints: record.rawCodepoints,
        rawSequence: record.rawSequence,
        rawMetadata: record.rawMetadata,
        rawArtworkReference: record.rawArtworkReference,
        recordType: record.recordType,
      },
      fluentMetadataIndex,
    );

    if (record.source === "fluent") {
      if (isUnicodeIdentity(resolution.canonicalIdentity)) {
        fluentRecordsCorrected += 1;
      } else {
        fluentRecordsUnresolved += 1;
      }
    }

    rawToCanonical.push({
      source: record.source,
      sourceId: record.sourceId,
      canonicalIdentity: resolution.canonicalIdentity,
      identityCategory: resolution.identityCategory,
      normalizedSequence: resolution.normalizedSequence,
      mappingMethod: resolution.mappingMethod,
      recordKind: "source",
    });

    const key = `${record.source}:${record.sourceId}`;
    const existing = sourceIdentityByKey.get(key);
    if (existing && existing !== resolution.canonicalIdentity) {
      conflicts.push({
        type: "duplicate-source-key",
        source: record.source,
        sourceId: record.sourceId,
        details: "Duplicate source key resolved to different canonical identities",
        candidates: [existing, resolution.canonicalIdentity],
        category: "genuine-identity",
        resolution: "Distinct canonical identities for the same source key.",
      });
    } else {
      sourceIdentityByKey.set(key, resolution.canonicalIdentity);
    }

    for (const detail of recordConflicts) {
      conflicts.push({
        type: detail.type,
        source: record.source,
        sourceId: record.sourceId,
        details: detail.details,
        candidates: detail.candidates,
        category: detail.category,
        resolution:
          detail.category === "presentation-variation"
            ? "Presentation-only difference; keep authoritative rawCodepoints identity."
            : "Conflicting source fields; manual review required.",
      });
    }
  }

  const artworkMappings: ArtworkIdentityMapping[] = [];
  for (const record of artworkRecords) {
    const resolution = resolveArtworkIdentity(
      {
        source: record.source,
        sourceId: record.sourceId,
        sourceVersion: record.sourceVersion,
        stagedPath: record.stagedPath,
        originalPath: record.originalPath,
        rawLicense: record.rawLicense,
        checksum: record.checksum,
      },
      fluentMetadataIndex,
    );

    artworkMappings.push({
      provider: record.source,
      sourceId: record.sourceId,
      canonicalIdentity: resolution.canonicalIdentity,
      path: record.stagedPath,
      checksum: record.checksum,
      version: record.sourceVersion,
      license: record.rawLicense,
      identityCategory: identityCategoryForArtwork(resolution),
      mappingMethod: resolution.mappingMethod,
    });
  }

  const metadataMappings: MetadataIdentityMapping[] = [];
  for (const record of metadataRecords) {
    const { resolution, conflicts: recordConflicts } = resolveMetadataIdentity(
      {
        source: record.source,
        sourceId: record.sourceId,
        rawEmoji: record.rawEmoji,
        rawCodepoints: record.rawCodepoints,
        rawSequence: record.rawSequence,
        rawMetadata: record.rawMetadata,
        recordType: record.recordType,
      },
      fluentMetadataIndex,
    );

    metadataMappings.push({
      source: record.source,
      sourceId: record.sourceId,
      canonicalIdentity: resolution.canonicalIdentity,
      identityCategory: resolution.identityCategory,
      mappingMethod: resolution.mappingMethod,
    });

    for (const detail of recordConflicts) {
      conflicts.push({
        type: `metadata-${detail.type}`,
        source: record.source,
        sourceId: record.sourceId,
        details: detail.details,
        candidates: detail.candidates,
        category: detail.category,
        resolution:
          record.source === "fluent"
            ? "Fluent metadata.unicode is authoritative; rawCodepoints are ASCII-ingestion artifacts."
            : detail.category === "presentation-variation"
              ? "Presentation-only difference; keep authoritative rawCodepoints identity."
              : "Conflicting source fields; manual review required.",
      });
    }
  }

  const canonicalToSource: Record<string, CanonicalSourceRef[]> = {};
  function addCanonicalRef(canonicalIdentity: string, ref: CanonicalSourceRef): void {
    if (!canonicalToSource[canonicalIdentity]) {
      canonicalToSource[canonicalIdentity] = [];
    }
    canonicalToSource[canonicalIdentity].push(ref);
  }

  for (const mapping of rawToCanonical) {
    addCanonicalRef(mapping.canonicalIdentity, {
      source: mapping.source,
      sourceId: mapping.sourceId,
      recordKind: "source",
      identityCategory: mapping.identityCategory,
    });
  }

  for (const mapping of artworkMappings) {
    addCanonicalRef(mapping.canonicalIdentity, {
      source: mapping.provider,
      sourceId: mapping.sourceId,
      recordKind: "artwork",
      identityCategory: mapping.identityCategory,
    });
  }

  for (const mapping of metadataMappings) {
    addCanonicalRef(mapping.canonicalIdentity, {
      source: mapping.source,
      sourceId: mapping.sourceId,
      recordKind: "metadata",
      identityCategory: mapping.identityCategory,
    });
  }

  for (const refs of Object.values(canonicalToSource)) {
    refs.sort((left, right) => {
      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }
      return left.sourceId.localeCompare(right.sourceId);
    });
  }

  const variationSelectorAudit = buildVariationSelectorAudit(
    [...sourceRecords, ...metadataRecords].map((record) => ({
      source: record.source,
      sourceId: record.sourceId,
      rawSequence: record.rawSequence,
      rawCodepoints: record.rawCodepoints,
      rawEmoji: record.rawEmoji,
      rawMetadata: record.rawMetadata,
    })),
  );

  const originallyUnmatchedRecords = sourceRecords.filter((record) => {
    const mapping = rawToCanonical.find(
      (entry) => entry.source === record.source && entry.sourceId === record.sourceId,
    );
    return (
      mapping?.identityCategory === "unmatched" ||
      mapping?.identityCategory === "source-specific" ||
      (!isUnicodeIdentity(mapping?.canonicalIdentity ?? "") &&
        record.source === "noto" &&
        !/^[0-9A-F-]+(?:-[0-9A-F]+)*$/i.test(record.rawSequence))
    );
  });

  const unmatchedClassification = buildUnmatchedClassification(
    originallyUnmatchedRecords.map((record) => ({
      source: record.source,
      sourceId: record.sourceId,
      recordType: record.recordType,
      rawSequence: record.rawSequence,
      rawCodepoints: record.rawCodepoints,
      rawArtworkReference: record.rawArtworkReference,
      stagedPath: record.rawArtworkReference,
    })),
  );

  const privateUseAudit = buildPrivateUseAudit(rawToCanonical, sourceRecords);
  const conflictReport = buildConflictReport(conflicts, ORIGINAL_CONFLICT_COUNT);

  const emojinetRecords = rawToCanonical.filter((mapping) => mapping.source === "emojinet");
  const emojinetMatched = emojinetRecords.filter((mapping) =>
    isUnicodeIdentity(mapping.canonicalIdentity),
  );
  const emojinetUnmatched = emojinetRecords.filter(
    (mapping) => !isUnicodeIdentity(mapping.canonicalIdentity),
  );
  const emojinetReport: EmojiNetIdentityReport = {
    generatedAt: new Date().toISOString(),
    total: emojinetRecords.length,
    matched: emojinetMatched.length,
    unmatched: emojinetUnmatched.length,
    unicodeMappings: emojinetMatched.length,
    nonUnicodeRecords: emojinetUnmatched.length,
    records: emojinetRecords.map((mapping) => ({
      sourceId: mapping.sourceId,
      canonicalIdentity: mapping.canonicalIdentity,
      identityCategory: mapping.identityCategory,
      recordType:
        sourceRecords.find((record) => record.sourceId === mapping.sourceId)?.recordType ?? "unknown",
    })),
  };

  const emojiTimeMappings: EmojiTimeIdentityMapping[] = sourceRecords
    .filter((record) => record.source === "emoji-time")
    .map((record) => {
      const mapping = rawToCanonical.find(
        (entry) => entry.source === record.source && entry.sourceId === record.sourceId,
      );
      const metadata = record.rawMetadata as {
        hour?: number;
        halfHour?: boolean;
        hexcode?: string;
        emoji?: string;
      };
      return {
        source: record.source,
        sourceId: record.sourceId,
        mapping: {
          hour: metadata.hour ?? -1,
          halfHour: metadata.halfHour ?? false,
          hexcode: metadata.hexcode ?? record.rawSequence,
          emoji: metadata.emoji ?? record.rawEmoji ?? "",
        },
        canonicalIdentity: mapping?.canonicalIdentity ?? "unmapped",
      };
    });

  const openmojiExtras = sourceRecords.filter((record) => record.sourceId.startsWith("openmoji-extra:"));
  const categoryCounts = rawToCanonical.reduce<Record<string, number>>((counts, mapping) => {
    counts[mapping.identityCategory] = (counts[mapping.identityCategory] ?? 0) + 1;
    return counts;
  }, {});

  const uniqueUnicodeIdentities = new Set(
    [...rawToCanonical, ...artworkMappings, ...metadataMappings]
      .map((mapping) => mapping.canonicalIdentity)
      .filter(isUnicodeIdentity),
  );
  const uniqueSourceSpecificIdentities = new Set(
    [...rawToCanonical, ...artworkMappings, ...metadataMappings]
      .map((mapping) => mapping.canonicalIdentity)
      .filter((identity) => identity.startsWith("source:")),
  );
  const privateUseIdentities = new Set(
    [...rawToCanonical, ...artworkMappings, ...metadataMappings]
      .filter((mapping) => mapping.identityCategory === "private-use")
      .map((mapping) => mapping.canonicalIdentity),
  );

  const auditReport: IdentityAuditReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    baselines: {
      rawRecords: 72228,
      artwork: 40071,
      metadata: 34784,
      semantic: 15183,
      nonUnicode: 734,
    },
    counts: {
      rawSourceMappings: rawToCanonical.length,
      artworkMappings: artworkMappings.length,
      metadataMappings: metadataMappings.length,
      uniqueUnicodeIdentities: uniqueUnicodeIdentities.size,
      uniqueSourceSpecificIdentities: uniqueSourceSpecificIdentities.size,
      privateUseIdentities: privateUseIdentities.size,
      metadataOnlyIdentities: metadataMappings.filter(
        (mapping) => mapping.identityCategory === "metadata-only",
      ).length,
      artworkOnlyIdentities: artworkMappings.filter(
        (mapping) => mapping.identityCategory === "artwork-only",
      ).length,
      semanticOnlyIdentities: rawToCanonical.filter(
        (mapping) => mapping.identityCategory === "semantic-only",
      ).length,
      unmatchedIdentities: rawToCanonical.filter(
        (mapping) => mapping.identityCategory === "unmatched",
      ).length,
      potentialConflicts: conflicts.length,
    },
    identityCategories: categoryCounts,
    emojinet: {
      total: emojinetReport.total,
      matched: emojinetReport.matched,
      unmatched: emojinetReport.unmatched,
      unicodeMappings: emojinetReport.unicodeMappings,
      nonUnicodeRecords: emojinetReport.nonUnicodeRecords,
    },
    emojiTime: {
      total: emojiTimeMappings.length,
      mapped: emojiTimeMappings.filter((mapping) => mapping.canonicalIdentity.startsWith("unicode:"))
        .length,
    },
    openmojiExtras: {
      total: openmojiExtras.length,
      privateUse: openmojiExtras.filter((record) =>
        rawToCanonical.some(
          (mapping) =>
            mapping.sourceId === record.sourceId && mapping.identityCategory === "private-use",
        ),
      ).length,
      unicode: openmojiExtras.filter((record) =>
        rawToCanonical.some(
          (mapping) =>
            mapping.sourceId === record.sourceId && isUnicodeIdentity(mapping.canonicalIdentity),
        ),
      ).length,
    },
    existingDataCheck: {
      standardRecords: standardCount,
      extrasRecords: extrasCount,
      standardRecordsExpected: 3944,
      extrasRecordsExpected: 542,
      intact: standardCount === 3944 && extrasCount === 542,
    },
    note: "Phase 8.3a identity-normalization audit. Not the final emoji count.",
  };

  const phase83aReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    originalConflicts: ORIGINAL_CONFLICT_COUNT,
    remainingConflicts: conflicts.length,
    resolvedConflicts: ORIGINAL_CONFLICT_COUNT - conflicts.length,
    conflictReport: conflictReport.totals,
    fluentCorrections: {
      recordsAffected: sourceRecords.filter((record) => record.source === "fluent").length,
      recordsCorrected: fluentRecordsCorrected,
      recordsStillUnresolved: fluentRecordsUnresolved,
      authoritativeField: "fluent.metadata.unicode / fluent.metadata.glyph",
    },
    unmatchedClassification: {
      originallyUnmatchedInPhase83: 387,
      classifiedTotal: unmatchedClassification.total,
      byClassification: unmatchedClassification.byClassification,
    },
    privateUseReconciliation: privateUseAudit.summary,
    constraints: {
      rawSourceDataUnchanged: true,
      productionDataUnchanged: auditReport.existingDataCheck.intact,
      deduplicationPerformed: false,
      canonicalMasterRecordsCreated: false,
    },
  };

  writeJson(join(identityDir, "raw-to-canonical-index.json"), rawToCanonical);
  writeJson(join(identityDir, "canonical-to-source-index.json"), canonicalToSource);
  writeJson(join(identityDir, "artwork-identity-index.json"), artworkMappings);
  writeJson(join(identityDir, "metadata-identity-index.json"), metadataMappings);
  writeJson(join(identityDir, "identity-conflicts.json"), conflictReport);
  writeJson(join(identityDir, "variation-selector-audit.json"), {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    ...variationSelectorAudit,
  });
  writeJson(join(identityDir, "unmatched-classification.json"), {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    ...unmatchedClassification,
  });
  writeJson(join(identityDir, "private-use-audit.json"), privateUseAudit);
  writeJson(join(identityDir, "phase-8-3a-report.json"), phase83aReport);
  writeJson(join(identityDir, "emojinet-identity-report.json"), emojinetReport);
  writeJson(join(identityDir, "emoji-time-identity-index.json"), emojiTimeMappings);
  writeJson(join(identityDir, "identity-audit-report.json"), auditReport);

  console.log("Phase 8.3a identity audit built.");
  console.log(JSON.stringify(phase83aReport, null, 2));
}

main();
