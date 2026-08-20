const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase10");
function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("pipeline.ts", `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord } from "../phase9/types";
import { EXPECTED_RAW_BASELINE } from "../phase7/pipeline";
import { hashRawFile } from "../phase7/raw-snapshot";
import {
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase10ManifestPath,
  PHASE10_PIPELINE_VERSION,
} from "../../storage/paths";
import { computeQualityV2 } from "./quality-v2";
import { computeBeautyV1 } from "./beauty-v1";
import { computeUniquenessV1 } from "./uniqueness-v1";
import { computeExpressivenessV1 } from "./expressiveness-v1";
import { computeOverallV1, scoreDistribution } from "./overall-v1";
import { auditDuplicates, countUniqueCanonical } from "./duplicate-audit";
import { buildReviewQueues } from "./review-queues";
import { buildRankings } from "./rankings";
import type { Phase10Manifest, Phase10ScoredRecord, QualityBucket, ScoreConfidence } from "./types";

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\\n", "utf8");
}

export interface Phase10PipelineResult {
  readonly manifest: Phase10Manifest;
}

export function runPhase10Pipeline(rootDir: string): Phase10PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const rawBefore = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  if (rawBefore.length !== EXPECTED_RAW_BASELINE) errors.push("raw count mismatch");

  const p8Dir = getPhase8ProposedLibraryDir(rootDir);
  const canonical = JSON.parse(readFileSync(join(p8Dir, "canonical-records.json"), "utf8")) as CanonicalRecord[];
  const dupGroups = JSON.parse(readFileSync(join(p8Dir, "duplicate-groups.json"), "utf8")) as Array<{
    duplicate_group_id: string; members: string[]; relationship_type: string; confidence: string; canonical_id: string;
  }>;
  const variantGroups = JSON.parse(readFileSync(join(p8Dir, "variant-groups.json"), "utf8")) as Array<{
    variant_group_id: string; variant_type: string; raw_ids: string[];
  }>;
  const editorial = JSON.parse(readFileSync(join(getPhase9EditorialDir(rootDir), "editorial-records.json"), "utf8")) as KaomojiEditorialRecord[];
  const editorialById = new Map(editorial.map((e) => [e.canonical_id, e]));

  const normFreq = new Map<string, number>();
  for (const c of canonical) {
    normFreq.set(c.normalized_content, (normFreq.get(c.normalized_content) ?? 0) + 1);
  }

  const variantByCanonical = new Map<string, { type: string }>();
  for (const vg of variantGroups) {
    for (const rid of vg.raw_ids) {
      const rec = canonical.find((c) => c.created_from_raw_ids.includes(rid));
      if (rec) variantByCanonical.set(rec.canonical_id, { type: vg.variant_type });
    }
  }

  const scored: Phase10ScoredRecord[] = [];
  const qualityBuckets: Record<QualityBucket, number> = {
    EXCELLENT: 0, HIGH: 0, GOOD: 0, MEDIUM: 0, LOW: 0, INVALID_REVIEW: 0,
  };
  const beautyDist: Record<string, number> = {};
  const uniqDist: Record<string, number> = {};
  const exprDist: Record<string, number> = {};
  const overallDist: Record<string, number> = {};
  const confDist: Record<ScoreConfidence, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const publication: Record<string, number> = {};
  let lowQuality = 0;
  let review = 0;
  let removeCandidates = 0;

  for (const c of canonical) {
    const ed = editorialById.get(c.canonical_id);
    if (!ed) { warnings.push(\`missing editorial: \${c.canonical_id}\`); continue; }
    const q = computeQualityV2(ed);
    const b = computeBeautyV1(c.canonical_content);
    const u = computeUniquenessV1(ed, normFreq);
    const e = computeExpressivenessV1(c.canonical_content);
    const o = computeOverallV1(q.score, b.score, u.score, e.score);
    const variantInfo = variantByCanonical.get(c.canonical_id);
    let scoreConf: ScoreConfidence = "HIGH";
    if (q.reasons.length > 0 || ed.category_status === "REVIEW") scoreConf = "MEDIUM";
    if (q.bucket === "INVALID_REVIEW" || ed.curation_status === "REMOVE_CANDIDATE") scoreConf = "LOW";

    const record: Phase10ScoredRecord = {
      canonical_id: c.canonical_id,
      canonical_content: c.canonical_content,
      normalized_content: c.normalized_content,
      quality_score_v2: q.score,
      quality_score_v1: ed.quality_score,
      quality_version: q.score !== ed.quality_score ? "10.0.0-quality-v2" : ed.quality_version,
      quality_components: q.components,
      quality_status: q.status,
      quality_bucket: q.bucket,
      quality_reasons: q.reasons,
      beauty_score_v1: b.score,
      beauty_version: "10.0.0-aesthetic-v1",
      beauty_components: b.components,
      beauty_features: b.features,
      uniqueness_score_v1: u.score,
      uniqueness_version: "10.0.0-uniqueness-v1",
      uniqueness_components: u.components,
      expressiveness_score_v1: e.score,
      expressiveness_version: "10.0.0-expressiveness-v1",
      expressiveness_components: e.components,
      overall_score_v1: o.score,
      overall_version: "10.0.0-overall-v1",
      overall_components: o.components,
      score_confidence: scoreConf,
      popularity_score: null,
      popularity_status: "INSUFFICIENT_DATA",
      duplicate_group_id: c.duplicate_group_id,
      variant_group_id: c.variant_group_id,
      variant_type: variantInfo?.type ?? null,
      variant_confidence: variantInfo ? "MEDIUM" : null,
      publication_status: c.publication_status,
      curation_status: c.curation_status,
      is_public: ed.is_public,
      review_queues: [],
    };
    record.review_queues = buildReviewQueues(record);
    scored.push(record);

    qualityBuckets[q.bucket] += 1;
    beautyDist[scoreDistribution(b.score)] = (beautyDist[scoreDistribution(b.score)] ?? 0) + 1;
    uniqDist[scoreDistribution(u.score)] = (uniqDist[scoreDistribution(u.score)] ?? 0) + 1;
    exprDist[scoreDistribution(e.score)] = (exprDist[scoreDistribution(e.score)] ?? 0) + 1;
    overallDist[scoreDistribution(o.score)] = (overallDist[scoreDistribution(o.score)] ?? 0) + 1;
    confDist[scoreConf] += 1;
    publication[c.publication_status] = (publication[c.publication_status] ?? 0) + 1;
    if (q.bucket === "LOW" || q.bucket === "INVALID_REVIEW") lowQuality += 1;
    if (c.curation_status === "REVIEW") review += 1;
    if (c.curation_status === "REMOVE_CANDIDATE") removeCandidates += 1;
  }

  scored.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
  const dupAudit = auditDuplicates(canonical, dupGroups);
  const { rankings, collections: rankCollections } = buildRankings(scored);

  const rawShaAfter = hashRawFile(rawPath).sha256;
  const rawAfter = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed");
  if (rawAfter.length !== rawBefore.length) errors.push("RAW count changed after processing");

  const out = getPhase10RootDir(rootDir);
  writeJson(join(out, "quality-v2", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, quality_score_v2: r.quality_score_v2, quality_score_v1: r.quality_score_v1,
    quality_components: r.quality_components, quality_status: r.quality_status, quality_bucket: r.quality_bucket, quality_reasons: r.quality_reasons,
  })));
  writeJson(join(out, "beauty-v1", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, beauty_score_v1: r.beauty_score_v1, beauty_components: r.beauty_components, beauty_features: r.beauty_features,
  })));
  writeJson(join(out, "uniqueness-v1", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, uniqueness_score_v1: r.uniqueness_score_v1, uniqueness_components: r.uniqueness_components,
  })));
  writeJson(join(out, "expressiveness-v1", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, expressiveness_score_v1: r.expressiveness_score_v1, expressiveness_components: r.expressiveness_components,
  })));
  writeJson(join(out, "overall-v1", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, overall_score_v1: r.overall_score_v1, overall_components: r.overall_components,
    quality_score_v2: r.quality_score_v2, beauty_score_v1: r.beauty_score_v1, uniqueness_score_v1: r.uniqueness_score_v1, expressiveness_score_v1: r.expressiveness_score_v1,
    popularity_score: null, popularity_status: r.popularity_status,
  })));
  writeJson(join(out, "duplicate-audit", "groups.json"), dupAudit);
  writeJson(join(out, "low-quality-audit", "records.json"), scored.filter((r) => r.quality_bucket === "LOW" || r.quality_bucket === "INVALID_REVIEW"));
  writeJson(join(out, "ranking", "rankings.json"), rankings);
  writeJson(join(out, "ranking", "collections.json"), rankCollections);
  writeJson(join(out, "review-queues", "records.json"), scored.filter((r) => r.review_queues.length > 0));
  writeJson(join(out, "publication-gate", "records.json"), scored.map((r) => ({
    canonical_id: r.canonical_id, is_public: r.is_public, publication_status: r.publication_status, curation_status: r.curation_status,
  })));
  writeJson(join(out, "scored-records.json"), scored);

  const manifest: Phase10Manifest = {
    phase: 10,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE10_PIPELINE_VERSION,
    raw_before: rawBefore.length,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    raw_sha256: rawShaAfter,
    canonical_candidates: canonical.length,
    duplicate_groups: dupAudit.length,
    variant_groups: variantGroups.length,
    legitimate_variants: variantGroups.filter((v) => v.variant_type !== "category_context").length,
    unique_records: countUniqueCanonical(canonical),
    low_quality: lowQuality,
    review,
    remove_candidates: removeCandidates,
    quality_buckets: qualityBuckets,
    beauty_distribution: beautyDist,
    uniqueness_distribution: uniqDist,
    expressiveness_distribution: exprDist,
    overall_distribution: overallDist,
    score_confidence: confDist,
    publication,
    popularity_status: "INSUFFICIENT_DATA",
    errors,
    warnings,
  };
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase10ManifestPath(rootDir), manifest);
  return { manifest };
}
`);

console.log("phase10 pipeline done");
