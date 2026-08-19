import type { Phase10ScoredRecord } from "./types";

export function buildReviewQueues(record: Phase10ScoredRecord): string[] {
  const queues: string[] = [];
  if (record.quality_status === "REVIEW" || record.quality_bucket === "INVALID_REVIEW") queues.push("quality_uncertainty");
  if (record.score_confidence === "LOW") queues.push("score_uncertainty");
  if (record.beauty_score_v1 < 40 && record.quality_score_v2 >= 60) queues.push("beauty_uncertainty");
  if (record.curation_status === "REVIEW") queues.push("curation_review");
  if (record.publication_status === "REVIEW_REQUIRED") queues.push("license_review");
  if (record.variant_group_id && record.variant_confidence === "LOW") queues.push("variant_uncertainty");
  return queues;
}
