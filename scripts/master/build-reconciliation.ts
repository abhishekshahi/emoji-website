import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type {
  MetadataKeywordIndexEntry,
  MetadataNameConflictEntry,
  RawMetadataIndexRecord,
  ShortcodeSourceIndexEntry,
} from "../../src/lib/master/metadata/types";
import { buildReconciliationDatabase } from "../../src/lib/master/reconciliation/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const metadataDir = join(masterDir, "metadata");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function verifyFileUnchanged(path: string, expectedCount: number): void {
  const data = readJson<unknown[]>(path);
  if (data.length !== expectedCount) {
    throw new Error(`Production file changed: ${path} expected ${expectedCount}, got ${data.length}`);
  }
}

function verifyMetadataManifestUnchanged(): void {
  const manifest = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));
  const phase86Count = 42910;
  if (manifest.length !== phase86Count) {
    throw new Error(`Phase 8.6 raw metadata index changed: expected ${phase86Count}, got ${manifest.length}`);
  }
}

function main(): void {
  verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);
  verifyMetadataManifestUnchanged();

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json"));
  if (canonicalRecords.length !== 6955) {
    throw new Error(`Canonical identity count changed: expected 6955, got ${canonicalRecords.length}`);
  }

  const rawMetadataIndex = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));
  const metadataNameConflicts = readJson<MetadataNameConflictEntry[]>(
    join(metadataDir, "metadata-name-conflicts.json"),
  );
  const metadataKeywordIndex = readJson<MetadataKeywordIndexEntry[]>(
    join(metadataDir, "metadata-keyword-index.json"),
  );
  const shortcodeSourceIndex = readJson<ShortcodeSourceIndexEntry[]>(
    join(metadataDir, "shortcode-source-index.json"),
  );

  if (metadataNameConflicts.length !== 4187) {
    throw new Error(`Name conflict baseline changed: expected 4187, got ${metadataNameConflicts.length}`);
  }

  const result = buildReconciliationDatabase({
    canonicalRecords,
    rawMetadataIndex,
    metadataNameConflicts,
    metadataKeywordIndex,
    shortcodeSourceIndex,
  });

  if (result.canonicalNameRecords.length !== 6955) {
    throw new Error(`Canonical name record count mismatch: expected 6955, got ${result.canonicalNameRecords.length}`);
  }

  writeJson(join(metadataDir, "canonical-name-records.json"), result.canonicalNameRecords);
  writeJson(join(metadataDir, "canonical-keywords.json"), result.canonicalKeywords);
  writeJson(join(metadataDir, "canonical-shortcodes.json"), result.canonicalShortcodes);
  writeJson(join(metadataDir, "canonical-seo-records.json"), result.canonicalSeoRecords);
  writeJson(join(metadataDir, "canonical-search-index.json"), result.canonicalSearchIndex);
  writeJson(join(metadataDir, "seo-conflicts.json"), result.seoConflicts);
  writeJson(join(metadataDir, "name-reconciliation-report.json"), result.nameReconciliationReport);

  console.log("Phase 8.7 reconciliation database built.");
  console.log(JSON.stringify(result.nameReconciliationReport.baselines, null, 2));
  console.log(JSON.stringify(result.nameReconciliationReport.conflictClassification, null, 2));
  console.log(JSON.stringify(result.nameReconciliationReport.resolutionCounts, null, 2));
  console.log(JSON.stringify(result.nameReconciliationReport.outputCounts, null, 2));
}

main();
