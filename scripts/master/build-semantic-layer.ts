import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { RawMetadataIndexRecord } from "../../src/lib/master/metadata/types";
import type { CanonicalKeywordEntry, CanonicalNameRecord, NameReconciliationReport } from "../../src/lib/master/reconciliation/types";
import { buildSemanticLayer } from "../../src/lib/master/semantic/build";
import type { SemanticDatabaseManifest } from "../../src/lib/master/semantic/types";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const metadataDir = join(masterDir, "metadata");
const semanticDir = join(masterDir, "semantic");

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

function main(): void {
  verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);

  const rawMetadataIndex = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));
  if (rawMetadataIndex.length !== 42910) {
    throw new Error(`Phase 8.6 raw metadata index changed: expected 42910, got ${rawMetadataIndex.length}`);
  }

  const semanticBaseline = rawMetadataIndex.filter((record) => record.recordType === "semantic").length;
  if (semanticBaseline !== 15183) {
    throw new Error(`EmojiNet semantic baseline changed: expected 15183, got ${semanticBaseline}`);
  }

  const definitionBaseline = rawMetadataIndex.filter((record) => record.fields.definition).length;
  if (definitionBaseline !== 17572) {
    throw new Error(`Definition baseline changed: expected 17572, got ${definitionBaseline}`);
  }

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json"));
  if (canonicalRecords.length !== 6955) {
    throw new Error(`Canonical identity count changed: expected 6955, got ${canonicalRecords.length}`);
  }

  const result = buildSemanticLayer({
    canonicalRecords,
    rawMetadataIndex,
    canonicalNameRecords: readJson<CanonicalNameRecord[]>(join(metadataDir, "canonical-name-records.json")),
    canonicalKeywords: readJson<CanonicalKeywordEntry[]>(join(metadataDir, "canonical-keywords.json")),
    nameReconciliationReport: readJson<NameReconciliationReport>(join(metadataDir, "name-reconciliation-report.json")),
  });

  if (result.semanticSourceIndex.length !== 15183) {
    throw new Error(`Semantic source index count mismatch: expected 15183, got ${result.semanticSourceIndex.length}`);
  }

  if (result.semanticDefinitionsIndex.length !== 17572) {
    throw new Error(`Definitions index count mismatch: expected 17572, got ${result.semanticDefinitionsIndex.length}`);
  }

  const manifest: SemanticDatabaseManifest = {
    generatedAt: new Date().toISOString(),
    phase: "8.8",
    files: {
      semanticSourceIndex: "master/semantic/semantic-source-index.json",
      canonicalSemanticIndex: "master/semantic/canonical-semantic-index.json",
      canonicalSemanticSearch: "master/semantic/canonical-semantic-search.json",
      semanticSeoIndex: "master/semantic/semantic-seo-index.json",
      semanticSearchTerms: "master/semantic/semantic-search-terms.json",
      semanticDefinitionsIndex: "master/semantic/semantic-definitions-index.json",
      semanticConflicts: "master/semantic/semantic-conflicts.json",
      semanticCoverageReport: "master/semantic/semantic-coverage-report.json",
      semanticSeoPolicyReport: "master/semantic/semantic-seo-policy-report.json",
    },
  };

  writeJson(join(semanticDir, "semantic-source-index.json"), result.semanticSourceIndex);
  writeJson(join(semanticDir, "canonical-semantic-index.json"), result.canonicalSemanticIndex);
  writeJson(join(semanticDir, "canonical-semantic-search.json"), result.canonicalSemanticSearch);
  writeJson(join(semanticDir, "semantic-seo-index.json"), result.semanticSeoIndex);
  writeJson(join(semanticDir, "semantic-search-terms.json"), result.semanticSearchTerms);
  writeJson(join(semanticDir, "semantic-definitions-index.json"), result.semanticDefinitionsIndex);
  writeJson(join(semanticDir, "semantic-conflicts.json"), result.semanticConflicts);
  writeJson(join(semanticDir, "semantic-coverage-report.json"), result.semanticCoverageReport);
  writeJson(join(semanticDir, "semantic-seo-policy-report.json"), result.semanticSeoPolicyReport);
  writeJson(join(semanticDir, "semantic-manifest.json"), manifest);

  console.log("Phase 8.8 semantic layer built.");
  console.log(JSON.stringify(result.semanticCoverageReport.totals, null, 2));
  console.log(JSON.stringify(result.semanticSeoPolicyReport.counts, null, 2));
  console.log(JSON.stringify(result.semanticSeoPolicyReport.preservation, null, 2));
}

main();
