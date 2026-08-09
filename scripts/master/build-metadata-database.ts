import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMetadataDatabase, type EmojibaseShortcodePacks } from "../../src/lib/master/metadata/build";
import type { MetadataDatabaseManifest } from "../../src/lib/master/metadata/types";
import type { RawMetadataInput } from "../../src/lib/master/metadata/extract";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const metadataDir = join(masterDir, "metadata");
const rawDir = join(masterDir, "raw");

interface MasterSourceLockFile {
  sources: Array<{
    source: string;
    version: string;
    license: string;
    licenseURL: string;
    attribution: string | null;
  }>;
}

interface RawMetadataManifestRecord extends RawMetadataInput {
  recordType: RawMetadataInput["recordType"];
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

function providerLicenseMap(lock: MasterSourceLockFile): Record<
  string,
  { license: string; licenseURL: string; attribution: string | null; version: string }
> {
  const map: Record<string, { license: string; licenseURL: string; attribution: string | null; version: string }> =
    {};

  for (const entry of lock.sources) {
    map[entry.source] = {
      license: entry.license,
      licenseURL: entry.licenseURL,
      attribution: entry.attribution,
      version: entry.version,
    };
  }

  return map;
}

function toRawMetadataInput(record: RawMetadataManifestRecord): RawMetadataInput {
  return {
    source: record.source,
    sourceVersion: record.sourceVersion,
    sourceId: record.sourceId,
    rawName: record.rawName,
    rawEmoji: record.rawEmoji,
    rawCodepoints: record.rawCodepoints,
    rawSequence: record.rawSequence,
    rawMetadata: record.rawMetadata,
    rawLicense: record.rawLicense,
    sourceURL: record.sourceURL,
    recordType: record.recordType,
  };
}

function main(): void {
  verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);

  const canonicalRecords = readJson<Array<{ canonicalId: string }>>(join(masterDir, "canonical-emojis.json"));
  const canonicalIds = canonicalRecords.map((record) => record.canonicalId);
  if (canonicalIds.length !== 6955) {
    throw new Error(`Canonical identity count changed: expected 6955, got ${canonicalIds.length}`);
  }

  const rawMetadataManifest = readJson<RawMetadataManifestRecord[]>(join(rawDir, "raw-metadata-records.json"));
  if (rawMetadataManifest.length !== 34784) {
    throw new Error(`Raw metadata manifest changed: expected 34784, got ${rawMetadataManifest.length}`);
  }

  const rawSourceRecords = readJson<RawMetadataManifestRecord[]>(join(rawDir, "raw-source-records.json"));
  const manifestUnicodeEmojiDataIds = new Set(
    rawMetadataManifest.filter((record) => record.source === "unicode-emoji-data").map((record) => record.sourceId),
  );
  const unicodeEmojiDataRecords = rawSourceRecords
    .filter((record) => record.source === "unicode-emoji-data")
    .filter((record) => !manifestUnicodeEmojiDataIds.has(record.sourceId));

  if (unicodeEmojiDataRecords.length !== 8126) {
    throw new Error(
      `Unexpected unicode-emoji-data source record count: expected 8126, got ${unicodeEmojiDataRecords.length}`,
    );
  }

  const metadataIdentityIndex = readJson<
    Array<{ source: string; sourceId: string; canonicalIdentity: string }>
  >(join(masterDir, "identity", "metadata-identity-index.json"));
  const rawToCanonicalIndex = readJson<
    Array<{ source: string; sourceId: string; canonicalIdentity: string }>
  >(join(masterDir, "identity", "raw-to-canonical-index.json"));
  const emojibaseShortcodes = readJson<EmojibaseShortcodePacks>(join(rawDir, "emojibase", "shortcodes"));
  const lock = readJson<MasterSourceLockFile>(join(rootDir, "src", "data", "master-source-lock.json"));

  const result = buildMetadataDatabase({
    rawMetadataRecords: rawMetadataManifest.map(toRawMetadataInput),
    unicodeEmojiDataRecords: unicodeEmojiDataRecords.map(toRawMetadataInput),
    metadataIdentityIndex,
    rawToCanonicalIndex,
    canonicalIds,
    emojibaseShortcodes,
    providerLicenses: providerLicenseMap(lock),
  });

  if (result.rawMetadataIndex.length !== 42910) {
    throw new Error(`Metadata master record count mismatch: expected 42910, got ${result.rawMetadataIndex.length}`);
  }

  const manifestRecordIds = new Set(
    rawMetadataManifest.map((record) => `${record.source}:${record.sourceId}`),
  );
  for (const record of result.rawMetadataIndex) {
    if (!record.source || !record.sourceId || !record.canonicalId) {
      throw new Error(`Metadata record missing required fields: ${record.metadataRecordId}`);
    }
    if (manifestRecordIds.has(`${record.source}:${record.sourceId}`)) {
      const original = rawMetadataManifest.find(
        (entry) => entry.source === record.source && entry.sourceId === record.sourceId,
      );
      if (!original) {
        throw new Error(`Missing original metadata record for ${record.metadataRecordId}`);
      }
      if (JSON.stringify(original.rawMetadata) !== JSON.stringify(record.rawMetadata)) {
        throw new Error(`Raw metadata changed for ${record.metadataRecordId}`);
      }
    }
  }

  const semanticBaseline = rawMetadataManifest.filter((record) => record.recordType === "semantic").length;
  const semanticBuilt = result.rawMetadataIndex.filter((record) => record.recordType === "semantic").length;
  if (semanticBuilt !== semanticBaseline) {
    throw new Error(`Semantic record count changed: expected ${semanticBaseline}, got ${semanticBuilt}`);
  }

  const manifest: MetadataDatabaseManifest = {
    generatedAt: new Date().toISOString(),
    phase: "8.6",
    recordCount: result.rawMetadataIndex.length,
    files: {
      rawMetadataIndex: "master/metadata/raw-metadata-index.json",
      metadataSourceIndex: "master/metadata/metadata-source-index.json",
      canonicalMetadataIndex: "master/metadata/canonical-metadata-index.json",
      metadataNameConflicts: "master/metadata/metadata-name-conflicts.json",
      metadataKeywordIndex: "master/metadata/metadata-keyword-index.json",
      shortcodeSourceIndex: "master/metadata/shortcode-source-index.json",
      metadataCoverageReport: "master/metadata/metadata-coverage-report.json",
      metadataProviderAvailability: "master/metadata/metadata-provider-availability.json",
      metadataAuditReport: "master/metadata/metadata-audit-report.json",
    },
  };

  writeJson(join(metadataDir, "raw-metadata-index.json"), result.rawMetadataIndex);
  writeJson(join(metadataDir, "metadata-source-index.json"), result.metadataSourceIndex);
  writeJson(join(metadataDir, "canonical-metadata-index.json"), result.canonicalMetadataIndex);
  writeJson(join(metadataDir, "metadata-name-conflicts.json"), result.metadataNameConflicts);
  writeJson(join(metadataDir, "metadata-keyword-index.json"), result.metadataKeywordIndex);
  writeJson(join(metadataDir, "shortcode-source-index.json"), result.shortcodeSourceIndex);
  writeJson(join(metadataDir, "metadata-coverage-report.json"), result.metadataCoverageReport);
  writeJson(join(metadataDir, "metadata-provider-availability.json"), result.metadataProviderAvailability);
  writeJson(join(metadataDir, "metadata-audit-report.json"), result.auditReport);
  writeJson(join(metadataDir, "metadata-manifest.json"), manifest);

  console.log("Phase 8.6 metadata database built.");
  console.log(JSON.stringify(result.auditReport.baselines, null, 2));
  console.log(JSON.stringify(result.auditReport.counts, null, 2));
  console.log(JSON.stringify(result.auditReport.perSource, null, 2));
}

main();
