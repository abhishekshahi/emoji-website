import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiEditorialRecord, KaomojiRelationship } from "../processing/phase9/types";
import type { PublicationGateResult } from "../processing/phase12/types";
import {
  getPhase12PublicQualityDir,
  getPhase19ExportDir,
} from "../storage/paths";
import { PRODUCTION_VERSION, SCHEMA_VERSION } from "./config";
import { verifyChecksum } from "./checksum";
import type { Phase19ExportSummary, Phase19Manifest, Phase19ValidationResult } from "./types";

const EXPECTED_PUBLIC = 50979;
const EXPECTED_RELATIONSHIPS = 392904;
const CANONICAL_ID_RE = /^kao_[0-9a-f]{16}$/;

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function validatePhase19Export(rootDir: string, summary?: Phase19ExportSummary): Phase19ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const libDir = getPhase12PublicQualityDir(rootDir);
  const exportDir = summary?.export_dir ?? getPhase19ExportDir(rootDir);

  const editorial = loadJson<KaomojiEditorialRecord[]>(join(libDir, "editorial.json")).filter((r) => r.is_public);
  const gates = loadJson<PublicationGateResult[]>(join(libDir, "publication-gate.json"));
  const relationships = loadJson<KaomojiRelationship[]>(join(libDir, "relationships.json"));
  const publicIds = new Set(editorial.map((r) => r.canonical_id));

  if (editorial.length !== EXPECTED_PUBLIC) {
    errors.push(`public record count ${editorial.length} != ${EXPECTED_PUBLIC}`);
  }

  let brokenRelationships = 0;
  for (const rel of relationships) {
    if (!publicIds.has(rel.from_canonical_id) || !publicIds.has(rel.to_canonical_id)) brokenRelationships += 1;
  }
  const validRelationships = relationships.length - brokenRelationships;
  if (validRelationships !== EXPECTED_RELATIONSHIPS) {
    errors.push(`valid relationships ${validRelationships} != ${EXPECTED_RELATIONSHIPS}`);
  }

  for (const r of editorial) {
    if (!CANONICAL_ID_RE.test(r.canonical_id)) errors.push(`invalid canonical id ${r.canonical_id}`);
    if (!r.slug?.trim()) errors.push(`missing slug for ${r.canonical_id}`);
    const gate = gates.find((g) => g.canonical_id === r.canonical_id);
    if (!gate?.publication_eligible) errors.push(`publication gate failed for ${r.canonical_id}`);
  }

  const slugSet = new Set<string>();
  for (const r of editorial) {
    if (slugSet.has(r.slug)) errors.push(`duplicate slug ${r.slug}`);
    slugSet.add(r.slug);
  }

  const d1Dir = join(exportDir, "d1");
  let d1BatchFiles = 0;
  if (existsSync(d1Dir)) {
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".sql")) d1BatchFiles += 1;
      }
    };
    walk(d1Dir);
  } else {
    errors.push("missing D1 export directory");
  }

  const manifestPath = join(exportDir, "r2", "rebuildable", "manifest.json");
  const checksumsPath = join(exportDir, "r2", "rebuildable", "checksums.json");
  if (!existsSync(manifestPath)) errors.push("missing R2 manifest");
  if (!existsSync(checksumsPath)) errors.push("missing checksums file");
  if (summary && summary.public_records !== editorial.length) errors.push("export summary public_records mismatch");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      public_records: editorial.length,
      relationships: validRelationships,
      collections: summary?.collections ?? 0,
      d1_batches: summary?.d1_batches ?? 0,
      broken_relationships: brokenRelationships,
    },
  };
}

export function validatePhase19Manifest(manifest: Phase19Manifest): Phase19ValidationResult {
  const errors: string[] = [];
  if (manifest.schema_version !== SCHEMA_VERSION) errors.push("schema version mismatch");
  if (manifest.production_version !== PRODUCTION_VERSION) errors.push("production version mismatch");
  if (manifest.public_records !== EXPECTED_PUBLIC) errors.push("manifest public_records mismatch");
  if (manifest.relationships !== EXPECTED_RELATIONSHIPS) errors.push("manifest relationships mismatch");
  if (manifest.raw_modified !== 0) errors.push("RAW was modified");
  return {
    valid: errors.length === 0 && manifest.validation.valid,
    errors: [...errors, ...manifest.errors],
    warnings: manifest.warnings,
    counts: manifest.validation.counts,
  };
}

export function validatePhase19Checksums(rootDir: string): boolean {
  const exportDir = getPhase19ExportDir(rootDir);
  const checksumsPath = join(exportDir, "r2", "rebuildable", "checksums.json");
  if (!existsSync(checksumsPath)) return false;
  const data = loadJson<{ entries: Array<{ path: string; sha256: string }> }>(checksumsPath);
  const searchIndex = join(exportDir, "r2", "public", "search-index-v2.json");
  const entry = data.entries.find((e) => e.path.includes("search-index-v2.json"));
  if (!entry || !existsSync(searchIndex)) return false;
  return verifyChecksum(searchIndex, entry.sha256);
}
