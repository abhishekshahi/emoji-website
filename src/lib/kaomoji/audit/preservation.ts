import type {
  AggregatedKaomojiRecord,
  MergeAuditEntry,
  PreservationAuditReport,
  RawKaomojiRecord,
} from "../types";

/** Verify raw records are preserved through aggregation. */
export function runPreservationAudit(
  rawRecords: readonly RawKaomojiRecord[],
  aggregatedRecords: readonly AggregatedKaomojiRecord[],
): PreservationAuditReport {
  const uniqueRawIds = new Set(rawRecords.map((r) => r.raw_id));
  const referencedRawIds = new Set<string>();

  for (const agg of aggregatedRecords) {
    for (const ref of agg.source_refs) {
      referencedRawIds.add(ref.raw_id);
    }
  }

  const silentDeletions = [...uniqueRawIds].filter((id) => !referencedRawIds.has(id)).length;
  const singleSourceCandidates = aggregatedRecords.filter((a) => a.source_count === 1).length;
  const multiSourceCandidates = aggregatedRecords.filter((a) => a.source_count > 1).length;

  const rawByCandidate = new Map<string, number>();
  for (const agg of aggregatedRecords) {
    rawByCandidate.set(agg.candidate_key, agg.source_refs.length);
  }
  const potentialDuplicates = [...rawByCandidate.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  );

  const mergeAudit: MergeAuditEntry[] = aggregatedRecords
    .filter((a) => a.source_refs.length > 1)
    .map((a) => ({
      reason: "multi_source_merge",
      target_record: a.aggregated_id,
      source_refs: a.source_refs,
      decision: "merged" as const,
      decision_version: "1.0.0",
    }));

  return {
    generated_at: new Date().toISOString(),
    total_raw_records: rawRecords.length,
    unique_raw_records: uniqueRawIds.size,
    unique_normalized_candidates: aggregatedRecords.length,
    single_source_candidates: singleSourceCandidates,
    multi_source_candidates: multiSourceCandidates,
    potential_duplicates: potentialDuplicates,
    unique_candidates: aggregatedRecords.length,
    raw_gte_aggregated: rawRecords.length >= aggregatedRecords.length,
    silent_deletions: silentDeletions,
    merge_audit: mergeAudit,
  };
}
