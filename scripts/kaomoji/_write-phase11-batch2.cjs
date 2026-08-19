const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase11");
function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("pipeline.ts", `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord } from "../phase9/types";
import type { Phase10ScoredRecord } from "../phase10/types";
import { EXPECTED_RAW_BASELINE } from "../phase7/pipeline";
import { hashRawFile } from "../phase7/raw-snapshot";
import {
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase11ManifestPath,
  getPhase11RootDir,
  PHASE11_PIPELINE_VERSION,
} from "../../storage/paths";
import { runCompositionAudit } from "./composition-audit";
import type { Phase11Manifest } from "./types";

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\\n", "utf8");
}

export interface Phase11PipelineResult {
  readonly manifest: Phase11Manifest;
}

export function runPhase11Pipeline(rootDir: string): Phase11PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const rawBefore = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];

  if (rawBefore.length !== EXPECTED_RAW_BASELINE) errors.push("raw count mismatch");

  const p8 = getPhase8ProposedLibraryDir(rootDir);
  const canonical = JSON.parse(readFileSync(join(p8, "canonical-records.json"), "utf8")) as CanonicalRecord[];
  const dupGroups = JSON.parse(readFileSync(join(p8, "duplicate-groups.json"), "utf8")) as unknown[];
  const variantGroups = JSON.parse(readFileSync(join(p8, "variant-groups.json"), "utf8")) as Array<{
    variant_group_id: string; variant_type: string; raw_ids: string[];
  }>;
  const editorial = JSON.parse(readFileSync(join(getPhase9EditorialDir(rootDir), "editorial-records.json"), "utf8")) as KaomojiEditorialRecord[];
  const scored = JSON.parse(readFileSync(join(getPhase10RootDir(rootDir), "scored-records.json"), "utf8")) as Phase10ScoredRecord[];

  if (canonical.length !== editorial.length || canonical.length !== scored.length) {
    errors.push(\`layer count mismatch: canonical=\${canonical.length} editorial=\${editorial.length} scored=\${scored.length}\`);
  }

  const audit = runCompositionAudit({ canonical, editorial, scored, variantGroups });

  const rawShaAfter = hashRawFile(rawPath).sha256;
  const rawAfter = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed");
  if (rawAfter.length !== rawBefore.length) errors.push("RAW count changed");

  const out = getPhase11RootDir(rootDir);
  writeJson(join(out, "composition", "canonical-inventory.json"), audit.records);
  writeJson(join(out, "composition", "content-type-breakdown.json"), {
    primary: audit.primary_content_type,
    secondary_label_count: audit.secondary_content_type_labels,
  });
  writeJson(join(out, "composition", "style-breakdown.json"), {
    primary: audit.style_primary,
    multi_label_records: audit.style_multi_label_records,
  });
  writeJson(join(out, "composition", "emotion-breakdown.json"), audit.emotion);
  writeJson(join(out, "composition", "relationship-breakdown.json"), audit.relationship);
  writeJson(join(out, "composition", "cute-kawaii-breakdown.json"), audit.cute_kawaii);
  writeJson(join(out, "composition", "animal-breakdown.json"), audit.animals);
  writeJson(join(out, "composition", "action-breakdown.json"), audit.actions);
  writeJson(join(out, "composition", "variant-composition.json"), {
    groups: audit.variant_composition,
    member_counts: audit.variant_canonical_counts,
  });
  writeJson(join(out, "composition", "unique-composition.json"), audit.unique_composition);
  writeJson(join(out, "composition", "quality-breakdown.json"), audit.quality_buckets);
  writeJson(join(out, "composition", "score-distributions.json"), {
    beauty: audit.beauty_distribution,
    uniqueness: audit.uniqueness_distribution,
    expressiveness: audit.expressiveness_distribution,
    overall: audit.overall_distribution,
  });

  const manifest: Phase11Manifest = {
    phase: 11,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE11_PIPELINE_VERSION,
    raw_before: rawBefore.length,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    raw_sha256: rawShaAfter,
    canonical_candidates: canonical.length,
    canonical_definition: audit.definition,
    public_candidates: audit.public_candidates,
    review: audit.review,
    remove_candidates: audit.remove_candidates,
    duplicate_groups: dupGroups.length,
    variant_groups: audit.variant_groups,
    legitimate_variants: audit.legitimate_variants,
    unique_records: audit.unique_records,
    primary_content_type: audit.primary_content_type,
    secondary_content_type_labels: audit.secondary_content_type_labels,
    style_primary: audit.style_primary,
    style_multi_label_records: audit.style_multi_label_records,
    emotion: audit.emotion,
    relationship: audit.relationship,
    cute_kawaii: audit.cute_kawaii,
    animals: audit.animals,
    actions: audit.actions,
    variant_composition: audit.variant_composition,
    unique_composition: audit.unique_composition,
    quality_buckets: audit.quality_buckets,
    beauty_distribution: audit.beauty_distribution,
    uniqueness_distribution: audit.uniqueness_distribution,
    expressiveness_distribution: audit.expressiveness_distribution,
    overall_distribution: audit.overall_distribution,
    publication: audit.publication,
    curation: audit.curation,
    license: audit.license,
    provenance: audit.provenance,
    popularity_status: "INSUFFICIENT_DATA",
    errors,
    warnings,
  };

  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase11ManifestPath(rootDir), manifest);
  return { manifest };
}
`);

console.log("batch2 pipeline done");
