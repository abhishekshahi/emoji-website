import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalEmojiRecords,
  buildCrossSourceCoverage,
  buildSourceOnlyRecords,
  canonicalIdSet,
  productionCanonicalIdForExtra,
  productionCanonicalIdForStandard,
  type ArtworkIdentityMapping,
  type CanonicalSourceRef,
  type MetadataIdentityMapping,
  type RawToCanonicalMapping,
} from "../../src/lib/master/canonical/build";
import type {
  CanonicalAuditReport,
  CanonicalDatabaseManifest,
  CanonicalEmojiRecord,
} from "../../src/lib/master/canonical/types";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const identityDir = join(masterDir, "identity");

interface RawSourceRecord {
  source: string;
  sourceId: string;
  rawEmoji: string | null;
  recordType: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function verifyFileUnchanged(path: string, expectedCount: number): number {
  const data = readJson<unknown[]>(path);
  if (data.length !== expectedCount) {
    throw new Error(`Production file changed: ${path} expected ${expectedCount}, got ${data.length}`);
  }
  return data.length;
}

function countSourceOnly(
  records: ReturnType<typeof buildSourceOnlyRecords>,
  source: string,
): number {
  return records.filter((record) => record.soleSource === source).length;
}

function main(): void {
  const standardCount = verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  const extrasCount = verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);

  const rawToCanonical = readJson<RawToCanonicalMapping[]>(
    join(identityDir, "raw-to-canonical-index.json"),
  );
  const artworkIndex = readJson<ArtworkIdentityMapping[]>(
    join(identityDir, "artwork-identity-index.json"),
  );
  const metadataIndex = readJson<MetadataIdentityMapping[]>(
    join(identityDir, "metadata-identity-index.json"),
  );
  const canonicalToSource = readJson<Record<string, CanonicalSourceRef[]>>(
    join(identityDir, "canonical-to-source-index.json"),
  );
  const rawSourceRecords = readJson<RawSourceRecord[]>(join(masterDir, "raw", "raw-source-records.json"));

  const emojiBySourceKey = new Map<string, string | null>();
  for (const record of rawSourceRecords) {
    emojiBySourceKey.set(`${record.source}:${record.sourceId}`, record.rawEmoji);
  }

  const semanticSourceIds = new Set(
    rawSourceRecords.filter((record) => record.recordType === "semantic").map((record) => record.sourceId),
  );

  const canonicalRecords = buildCanonicalEmojiRecords({
    canonicalToSource,
    rawToCanonical,
    artworkIndex,
    metadataIndex,
    emojiBySourceKey,
    semanticSourceIds,
  });

  const crossSourceCoverage = buildCrossSourceCoverage(canonicalRecords);
  const sourceOnlyRecords = buildSourceOnlyRecords(canonicalRecords);
  const canonicalIds = canonicalIdSet(canonicalRecords);

  const standardEmojis = readJson<Array<{ hexcode: string }>>(join(rootDir, "src", "data", "emojis.json"));
  const extras = readJson<Array<{ hexcode: string }>>(join(rootDir, "src", "data", "openmoji-extras.json"));

  const standardMapped = standardEmojis.filter((record) =>
    canonicalIds.has(productionCanonicalIdForStandard(record.hexcode)),
  ).length;
  const extrasMapped = extras.filter((record) =>
    canonicalIds.has(productionCanonicalIdForExtra(record.hexcode)),
  ).length;

  const unicodeCanonical = canonicalRecords.filter((record) => record.identityType === "unicode");
  const privateUseCanonical = canonicalRecords.filter((record) => record.identityType === "private-use");
  const sourceSpecificCanonical = canonicalRecords.filter(
    (record) => record.identityType === "source-specific",
  );

  const uniqueSourceFamilies = (record: CanonicalEmojiRecord): number => {
    const sources = new Set<string>();
    for (const ref of record.sourceRecords) {
      sources.add(ref.source);
    }
    for (const ref of record.metadataRefs) {
      sources.add(ref.source);
    }
    for (const ref of record.semanticRefs) {
      sources.add(ref.source);
    }
    return sources.size;
  };

  const withMultipleSources = canonicalRecords.filter((record) => uniqueSourceFamilies(record) > 1);
  const withOneSource = canonicalRecords.filter((record) => uniqueSourceFamilies(record) === 1);
  const withArtwork = canonicalRecords.filter((record) =>
    Object.values(record.artwork).some((refs) => refs.length > 0),
  );
  const withMetadata = canonicalRecords.filter((record) => record.metadataRefs.length > 0);
  const withSemantic = canonicalRecords.filter((record) => record.semanticRefs.length > 0);

  const artworkOnlySourceRecords = rawSourceRecords.filter(
    (record) => record.recordType === "artwork-only",
  ).length;
  const metadataOnlySourceRecords = rawSourceRecords.filter(
    (record) => record.recordType === "metadata",
  ).length;
  const semanticOnlySourceRecords = rawSourceRecords.filter(
    (record) => record.recordType === "semantic",
  ).length;

  const auditReport: CanonicalAuditReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.4",
    baselines: {
      rawRecords: 72228,
      artwork: 40071,
      metadata: 34784,
      semantic: 15183,
    },
    counts: {
      uniqueUnicodeCanonicalIdentities: unicodeCanonical.length,
      uniqueSourceSpecificIdentities: sourceSpecificCanonical.length + privateUseCanonical.length,
      totalCanonicalIdentities: canonicalRecords.length,
      canonicalIdentitiesWithMultipleSources: withMultipleSources.length,
      canonicalIdentitiesWithOneSource: withOneSource.length,
      canonicalIdentitiesWithArtwork: withArtwork.length,
      canonicalIdentitiesWithMetadata: withMetadata.length,
      canonicalIdentitiesWithSemanticData: withSemantic.length,
      privateUseCanonicalIdentities: privateUseCanonical.length,
      sourceSpecificCanonicalIdentities: sourceSpecificCanonical.length,
      artworkOnlySourceRecords,
      metadataOnlySourceRecords,
      semanticOnlySourceRecords,
    },
    sourceOnly: {
      openmojiOnly: countSourceOnly(sourceOnlyRecords, "openmoji"),
      notoOnly: countSourceOnly(sourceOnlyRecords, "noto"),
      twemojiOnly: countSourceOnly(sourceOnlyRecords, "twemoji"),
      fluentOnly: countSourceOnly(sourceOnlyRecords, "fluent"),
      unicodeOnly: countSourceOnly(sourceOnlyRecords, "unicode"),
      emojibaseOnly: countSourceOnly(sourceOnlyRecords, "emojibase"),
      emojilibOnly: countSourceOnly(sourceOnlyRecords, "emojilib"),
      emojinetOnly: countSourceOnly(sourceOnlyRecords, "emojinet"),
      emojiTimeOnly: countSourceOnly(sourceOnlyRecords, "emoji-time"),
    },
    emojifindCompatibility: {
      standardRecords: standardCount,
      standardMapped,
      extrasRecords: extrasCount,
      extrasMapped,
      intact: standardCount === 3944 && extrasCount === 542 && standardMapped === 3944 && extrasMapped === 542,
    },
    note: "Canonical identity count before metadata/name/SEO policy. Not the final website emoji count.",
  };

  const manifest: CanonicalDatabaseManifest = {
    generatedAt: new Date().toISOString(),
    phase: "8.4",
    recordCount: canonicalRecords.length,
    files: {
      canonicalEmojis: "master/canonical-emojis.json",
      canonicalAuditReport: "master/canonical-audit-report.json",
      crossSourceCoverage: "master/cross-source-coverage.json",
      sourceOnlyRecords: "master/source-only-records.json",
    },
  };

  writeJson(join(masterDir, "canonical-emojis.json"), canonicalRecords);
  writeJson(join(masterDir, "canonical-audit-report.json"), auditReport);
  writeJson(join(masterDir, "cross-source-coverage.json"), crossSourceCoverage);
  writeJson(join(masterDir, "source-only-records.json"), sourceOnlyRecords);
  writeJson(join(masterDir, "canonical-manifest.json"), manifest);

  console.log("Phase 8.4 canonical database built.");
  console.log(JSON.stringify(auditReport.counts, null, 2));
  console.log(
    `EmojiFind compatibility: ${auditReport.emojifindCompatibility.standardMapped}/${auditReport.emojifindCompatibility.standardRecords} standard, ${auditReport.emojifindCompatibility.extrasMapped}/${auditReport.emojifindCompatibility.extrasRecords} extras`,
  );
}

main();
