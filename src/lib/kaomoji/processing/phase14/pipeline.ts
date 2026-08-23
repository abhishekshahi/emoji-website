import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiEditorialRecord } from "../phase9/types";
import { SEARCH_QUALITY_DATASET } from "../phase9/search-quality";
import { hashRawFile } from "../phase7/raw-snapshot";
import { buildSearchIndexV2, searchKaomojiV2 } from "./search-index-v2";
import { evaluateBenchmark } from "./benchmark-dataset";
import type { Phase14Manifest } from "./types";
import { PHASE14_SEARCH_VERSION } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase12PublicQualityDir,
  getPhase14ManifestPath,
  getPhase14RootDir,
  PHASE14_PIPELINE_VERSION,
} from "../../storage/paths";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase14PipelineResult {
  readonly manifest: Phase14Manifest;
}

export function runPhase14Pipeline(rootDir: string): Phase14PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const libDir = getPhase12PublicQualityDir(rootDir);
  const editorial = JSON.parse(readFileSync(join(libDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];

  const indexV2 = buildSearchIndexV2(editorial);
  let legacyPass = 0;
  for (const tc of SEARCH_QUALITY_DATASET) {
    if (searchKaomojiV2(indexV2, tc.query, 12).length >= tc.min_results) legacyPass++;
  }

  const benchmark = evaluateBenchmark((q, l) => searchKaomojiV2(indexV2, q, l).length);
  if (benchmark.pass_rate < 0.98) {
    warnings.push(`benchmark pass rate ${(benchmark.pass_rate * 100).toFixed(1)}% below 98% target`);
  }

  const out = getPhase14RootDir(rootDir);
  writeJson(join(out, "search-index-v2.json"), indexV2);
  writeJson(join(out, "benchmark-results.json"), benchmark);
  writeJson(join(out, "synonyms-v1.json"), { version: "1.0.0" });

  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 14");

  const manifest: Phase14Manifest = {
    phase: 14,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE14_PIPELINE_VERSION,
    search_version: PHASE14_SEARCH_VERSION,
    index_records: indexV2.records.length,
    legacy_pass_rate: SEARCH_QUALITY_DATASET.length > 0 ? legacyPass / SEARCH_QUALITY_DATASET.length : 0,
    legacy_pass_count: legacyPass,
    benchmark_queries: benchmark.total,
    benchmark_pass_rate: benchmark.pass_rate,
    benchmark_pass_count: benchmark.pass,
    zero_result_rate: benchmark.zero_result_rate,
    errors,
    warnings,
  };

  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "..", "manifests"), { recursive: true });
  writeJson(getPhase14ManifestPath(rootDir), manifest);
  return { manifest };
}