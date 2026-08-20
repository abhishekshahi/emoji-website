const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase12");
fs.mkdirSync(dir, { recursive: true });
function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("types.ts", `import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord, KaomojiCollection, KaomojiRelationship } from "../phase9/types";
import type { Phase10ScoredRecord, QualityBucket } from "../phase10/types";

export type PublicationBlockReason =
  | "quality_medium"
  | "quality_low"
  | "quality_invalid_review"
  | "curation_review"
  | "curation_remove_candidate"
  | "publication_review_required"
  | "publication_blocked"
  | "publication_remove_candidate"
  | "license_review_required"
  | "provenance_missing"
  | "provenance_unresolved";

export interface PublicationGateResult {
  readonly canonical_id: string;
  readonly quality_bucket: QualityBucket;
  readonly quality_qualified: boolean;
  readonly publication_eligible: boolean;
  readonly blocked_reason: PublicationBlockReason | null;
  readonly curation_status: string;
  readonly publication_status: string;
  readonly license_status: string;
  readonly provenance_status: string;
}

export interface ExcludedRecord {
  readonly canonical_id: string;
  readonly quality_bucket: QualityBucket;
  readonly reason: PublicationBlockReason;
  readonly publication_status: string;
  readonly license_status: string;
  readonly curation_status: string;
}

export interface PublicLibraryRecord {
  readonly canonical: CanonicalRecord;
  readonly editorial: KaomojiEditorialRecord;
  readonly scores: Phase10ScoredRecord;
}

export interface Phase12Manifest {
  readonly phase: 12;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256: string;
  readonly canonical_candidates: number;
  readonly quality_buckets: Record<QualityBucket, number>;
  readonly quality_qualified: number;
  readonly publication_eligible: number;
  readonly publication_blocked: number;
  readonly excellent_qualified: number;
  readonly high_qualified: number;
  readonly good_qualified: number;
  readonly excellent_public: number;
  readonly high_public: number;
  readonly good_public: number;
  readonly medium_excluded: number;
  readonly low_excluded: number;
  readonly invalid_excluded: number;
  readonly duplicate_groups_preserved: number;
  readonly variant_groups_preserved: number;
  readonly legitimate_variants_preserved: number;
  readonly popularity_status: "INSUFFICIENT_DATA";
  readonly storage: StorageReport;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface StorageReport {
  readonly excellent_bytes: number;
  readonly high_bytes: number;
  readonly good_bytes: number;
  readonly total_public_bytes: number;
  readonly breakdown: Record<string, number>;
}
`);

w("publication-filter.ts", `import type { CanonicalRecord } from "../phase8/types";
import { isPublicCandidate } from "../phase9/editorial-priority";
import type { Phase10ScoredRecord, QualityBucket } from "../phase10/types";
import type { PublicationBlockReason, PublicationGateResult } from "./types";

export const QUALITY_ELIGIBLE_BUCKETS: readonly QualityBucket[] = ["EXCELLENT", "HIGH", "GOOD"];

export function isQualityEligible(bucket: QualityBucket): boolean {
  return (QUALITY_ELIGIBLE_BUCKETS as readonly string[]).includes(bucket);
}

function blockReason(canonical: CanonicalRecord, bucket: QualityBucket): PublicationBlockReason {
  if (bucket === "MEDIUM") return "quality_medium";
  if (bucket === "LOW") return "quality_low";
  if (bucket === "INVALID_REVIEW") return "quality_invalid_review";
  if (canonical.curation_status === "REMOVE_CANDIDATE") return "curation_remove_candidate";
  if (canonical.curation_status === "REVIEW") return "curation_review";
  if (canonical.publication_status === "REMOVE_CANDIDATE") return "publication_remove_candidate";
  if (canonical.publication_status === "BLOCKED") return "publication_blocked";
  if (canonical.publication_status === "REVIEW_REQUIRED") return "publication_review_required";
  if (canonical.license_status === "REVIEW_REQUIRED") return "license_review_required";
  if (canonical.provenance_status === "MISSING") return "provenance_missing";
  if (canonical.provenance_status === "PROVENANCE_UNRESOLVED") return "provenance_unresolved";
  return "curation_review";
}

export function evaluatePublicationGate(
  canonical: CanonicalRecord,
  scored: Phase10ScoredRecord,
): PublicationGateResult {
  const quality_qualified = isQualityEligible(scored.quality_bucket);
  const publication_eligible = quality_qualified && isPublicCandidate(canonical);
  return {
    canonical_id: canonical.canonical_id,
    quality_bucket: scored.quality_bucket,
    quality_qualified,
    publication_eligible,
    blocked_reason: publication_eligible ? null : blockReason(canonical, scored.quality_bucket),
    curation_status: canonical.curation_status,
    publication_status: canonical.publication_status,
    license_status: canonical.license_status,
    provenance_status: canonical.provenance_status,
  };
}
`);

w("storage-measure.ts", `import { statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { StorageReport } from "./types";

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      total += entry.isDirectory() ? dirSize(p) : fileSize(p);
    }
  } catch {
    return 0;
  }
  return total;
}

export function measurePublicLibraryStorage(libDir: string): StorageReport {
  const breakdown: Record<string, number> = {};
  const files = [
    "canonical-records.json",
    "editorial.json",
    "scores.json",
    "categories.json",
    "keywords.json",
    "names.json",
    "meanings.json",
    "relationships.json",
    "collections.json",
    "provenance.json",
    "publication-gate.json",
    "search-index.json",
    "rankings.json",
    "excluded-manifest.json",
  ];
  for (const f of files) breakdown[f] = fileSize(join(libDir, f));
  breakdown.search_index = breakdown["search-index.json"] ?? 0;
  return {
    excellent_bytes: dirSize(join(libDir, "excellent")),
    high_bytes: dirSize(join(libDir, "high")),
    good_bytes: dirSize(join(libDir, "good")),
    total_public_bytes: Object.values(breakdown).reduce((a, b) => a + b, 0) + dirSize(join(libDir, "excellent")) + dirSize(join(libDir, "high")) + dirSize(join(libDir, "good")),
    breakdown,
  };
}

export function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(3) + " GB";
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}
`);

console.log("batch types/filter/storage done");
