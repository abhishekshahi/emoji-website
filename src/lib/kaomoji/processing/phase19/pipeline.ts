import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashRawFile } from "../phase7/raw-snapshot";
import { buildPhase19Export } from "../../cloudflare/export";
import { measurePhase19Storage } from "../../cloudflare/storage-measure";
import { validatePhase19Export } from "../../cloudflare/validation";
import { PRODUCTION_VERSION, SCHEMA_VERSION, getKaomojiCloudflareMode } from "../../cloudflare/config";
import { sha256File } from "../../cloudflare/checksum";
import type { Phase19Manifest } from "../../cloudflare/types";
import type { Phase19PipelineResult } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase14SearchIndexPath,
  getPhase15LocaleRegistryPath,
  getPhase19ManifestPath,
  getPhase19RootDir,
  PHASE19_PIPELINE_VERSION,
} from "../../storage/paths";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function runPhase19Pipeline(rootDir: string): Phase19PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const exportSummary = buildPhase19Export(rootDir);
  const validation = validatePhase19Export(rootDir, exportSummary);
  if (!validation.valid) errors.push(...validation.errors);
  warnings.push(...validation.warnings);
  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 19");
  const storage = measurePhase19Storage(rootDir);
  const localeSha = sha256File(getPhase15LocaleRegistryPath(rootDir)).sha256;
  const searchSha = sha256File(getPhase14SearchIndexPath(rootDir)).sha256;
  const manifest: Phase19Manifest = {
    phase: 19,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE19_PIPELINE_VERSION,
    schema_version: SCHEMA_VERSION,
    production_version: PRODUCTION_VERSION,
    cloudflare_mode: getKaomojiCloudflareMode(),
    public_records: exportSummary.public_records,
    relationships: exportSummary.relationships,
    relationships_rejected: exportSummary.relationships_rejected,
    collections: exportSummary.collections,
    categories: exportSummary.categories,
    keywords: exportSummary.keywords,
    d1_batches: exportSummary.d1_batches,
    d1_sql_files: exportSummary.d1_sql_files,
    r2_objects: exportSummary.d1_sql_files + 4,
    locale_registry_sha256: localeSha,
    search_index_sha256: searchSha,
    raw_sha256: rawShaAfter,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    storage,
    validation,
    rollback_version: null,
    errors,
    warnings,
  };
  const out = getPhase19RootDir(rootDir);
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase19ManifestPath(rootDir), manifest);
  return { manifest, export: exportSummary };
}
