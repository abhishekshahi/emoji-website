import type { CanonicalRecord } from "../phase8/types";
import { isPublicCandidate } from "../phase9/editorial-priority";
import type { Phase10ScoredRecord, QualityBucket } from "../phase10/types";
import type { PublicationBlockReason, PublicationGateResult } from "./types";

export const QUALITY_ELIGIBLE_BUCKETS: readonly QualityBucket[] = ["EXCELLENT", "HIGH", "GOOD", "MEDIUM"];

export function isQualityEligible(bucket: QualityBucket): boolean {
  return (QUALITY_ELIGIBLE_BUCKETS as readonly string[]).includes(bucket);
}

function blockReason(canonical: CanonicalRecord, bucket: QualityBucket): PublicationBlockReason {
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
