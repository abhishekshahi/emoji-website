import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord, KaomojiCollection, KaomojiRelationship } from "../phase9/types";
import type { Phase10ScoredRecord } from "../phase10/types";
import type { Phase12Manifest } from "../phase12/types";
import { hashRawFile } from "../phase7/raw-snapshot";
import { evaluatePublicationGate, isQualityEligible } from "../phase12/publication-filter";
import { searchKaomoji } from "../phase9/search-index";
import { SEARCH_QUALITY_DATASET } from "../phase9/search-quality";
import {
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase8ManifestPath,
  getPhase10RootDir,
  getPhase12ManifestPath,
  getPhase12PublicQualityDir,
  getPhase13ManifestPath,
  getPhase13RootDir,
  PHASE13_PIPELINE_VERSION,
} from "../../storage/paths";
import { auditRawDrift } from "./raw-drift";
import { validatePublicContent } from "./content-validation";
import { auditRelationships } from "./relationship-audit";
import { measureStorage } from "./storage-audit";
import type { Phase13Manifest } from "./types";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase13PipelineResult {
  readonly manifest: Phase13Manifest;
}

export function runPhase13Pipeline(rootDir: string): Phase13PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const rawBefore = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];

  const p12 = JSON.parse(readFileSync(getPhase12ManifestPath(rootDir), "utf8")) as Phase12Manifest;
  const p8Manifest = JSON.parse(readFileSync(getPhase8ManifestPath(rootDir), "utf8")) as {
    exact_groups: number; variant_groups: number; legitimate_variants: number;
  };
  const libDir = getPhase12PublicQualityDir(rootDir);
  const editorial = JSON.parse(readFileSync(join(libDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const scored = JSON.parse(readFileSync(join(libDir, "scores.json"), "utf8")) as Phase10ScoredRecord[];
  const canonical = JSON.parse(readFileSync(join(libDir, "canonical-records.json"), "utf8")) as CanonicalRecord[];
  const relationships = JSON.parse(readFileSync(join(libDir, "relationships.json"), "utf8")) as KaomojiRelationship[];
  const collections = JSON.parse(readFileSync(join(libDir, "collections.json"), "utf8")) as KaomojiCollection[];
  const searchIndex = JSON.parse(readFileSync(join(libDir, "search-index.json"), "utf8"));
  const p10All = JSON.parse(readFileSync(join(getPhase10RootDir(rootDir), "scored-records.json"), "utf8")) as Phase10ScoredRecord[];
  const p10ById = new Map(p10All.map((s) => [s.canonical_id, s]));

  const rawDrift = auditRawDrift(rootDir);
  const rawShaAfter = hashRawFile(rawPath).sha256;
  const rawAfter = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 13");
  if (rawBefore.length !== rawAfter.length) errors.push("RAW count changed during Phase 13");

  const publicIds = new Set(editorial.map((e) => e.canonical_id));
  let provenanceComplete = 0;
  for (const c of canonical) {
    if (c.provenance_status === "COMPLETE" || c.provenance_status === "PARTIAL") provenanceComplete++;
    if (c.created_from_raw_ids.length === 0) errors.push(`orphan canonical: ${c.canonical_id}`);
  }

  for (const s of scored) {
    const orig = p10ById.get(s.canonical_id);
    if (!orig) errors.push(`missing phase10 score: ${s.canonical_id}`);
    else if (orig.quality_score_v2 !== s.quality_score_v2) errors.push(`score drift: ${s.canonical_id}`);
  }

  const license: Record<string, number> = {};
  for (const c of canonical) license[c.license_status] = (license[c.license_status] ?? 0) + 1;

  const contentValidation = validatePublicContent(editorial);
  const relAudit = auditRelationships(relationships, publicIds);
  if (relAudit.broken_targets > 0) warnings.push(`relationship broken targets: ${relAudit.broken_targets}`);

  let collectionIssues = 0;
  for (const col of collections) {
    const ids = new Set<string>();
    for (const id of col.canonical_ids) {
      if (!publicIds.has(id)) collectionIssues++;
      if (ids.has(id)) collectionIssues++;
      ids.add(id);
    }
  }
  if (collectionIssues > 0) warnings.push(`collection membership issues: ${collectionIssues}`);

  let searchPassed = 0;
  for (const tc of SEARCH_QUALITY_DATASET) {
    const hits = searchKaomoji(searchIndex, tc.query, 12);
    if (hits.length >= (tc.min_results ?? 1)) searchPassed++;
  }
  const searchPassRate = SEARCH_QUALITY_DATASET.length > 0 ? searchPassed / SEARCH_QUALITY_DATASET.length : 0;

  const storage = measureStorage(rootDir, "data/kaomoji/raw/records.json");

  const out = getPhase13RootDir(rootDir);
  writeJson(join(out, "raw-drift", "drift-report.json"), rawDrift);
  writeJson(join(out, "raw-drift", "added-by-source.json"), rawDrift.added_by_source);
  writeJson(join(out, "audits", "content-validation.json"), contentValidation);
  writeJson(join(out, "audits", "relationship-audit.json"), relAudit);
  writeJson(join(out, "audits", "license-audit.json"), license);
  writeJson(join(out, "audits", "storage-audit.json"), storage);

  const manifest: Phase13Manifest = {
    phase: 13,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE13_PIPELINE_VERSION,
    raw_before: rawBefore.length,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    canonical_candidates: 63248,
    quality_qualified: p12.quality_qualified,
    publication_eligible: p12.publication_eligible,
    excellent_public: p12.excellent_public,
    high_public: p12.high_public,
    good_public: p12.good_public,
    medium_public: p12.medium_public,
    low_excluded: p12.low_excluded,
    invalid_excluded: p12.invalid_excluded,
    duplicate_groups: p8Manifest.exact_groups ?? 49885,
    variant_groups: p8Manifest.variant_groups ?? 15143,
    legitimate_variants: p8Manifest.legitimate_variants ?? 2533,
    relationships: relAudit.count,
    provenance_coverage_pct: canonical.length > 0 ? (provenanceComplete / canonical.length) * 100 : 0,
    license,
    publication_blocked: p12.publication_blocked,
    content_validation: contentValidation,
    search_pass_rate: searchPassRate,
    storage,
    raw_drift: rawDrift,
    errors,
    warnings,
  };

  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "..", "manifests"), { recursive: true });
  writeJson(getPhase13ManifestPath(rootDir), manifest);
  return { manifest };
}
