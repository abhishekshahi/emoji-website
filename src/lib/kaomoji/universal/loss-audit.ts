import type {
  AggregatedSourceItem,
  DedupAnalysisReport,
  NoLossReconciliationReport,
  NormalizedSourceItem,
  RawSourceItem,
  UniversalProvenanceRecord,
  UniversalValidationRecord,
} from "../types";

export function runNoLossAudit(input: {
  readonly rawItems: readonly RawSourceItem[];
  readonly aggregated: readonly AggregatedSourceItem[];
  readonly normalized: readonly NormalizedSourceItem[];
  readonly validation: readonly UniversalValidationRecord[];
  readonly provenance: readonly UniversalProvenanceRecord[];
  readonly dedup: DedupAnalysisReport;
}): NoLossReconciliationReport {
  const { rawItems, aggregated, normalized, validation, provenance, dedup } = input;
  const rawIds = new Set(rawItems.map((r) => r.source_item_id));
  const referencedIds = new Set<string>();
  for (const agg of aggregated) {
    for (const ref of agg.source_refs) referencedIds.add(ref.source_item_id);
  }
  const silentDeletions = [...rawIds].filter((id) => !referencedIds.has(id)).length;
  const normalizedIds = new Set(normalized.map((n) => n.aggregated_id));
  const aggregatedIds = new Set(aggregated.map((a) => a.aggregated_id));
  const normalizedMissing = [...aggregatedIds].filter((id) => !normalizedIds.has(id)).length;
  const provenanceRefs = provenance.reduce((sum, p) => sum + p.source_item_ids.length, 0);
  const provenanceCoverage = rawItems.length > 0 ? provenanceRefs / rawItems.length : 1;
  return {
    generated_at: new Date().toISOString(),
    total_raw_items: rawItems.length,
    total_unique_raw_items: new Set(rawItems.map((r) => r.original_content)).size,
    total_aggregated_items: aggregated.length,
    single_source_items: aggregated.filter((a) => a.source_count === 1).length,
    multi_source_items: aggregated.filter((a) => a.source_count > 1).length,
    exact_duplicates: dedup.exact_duplicates,
    unicode_equivalent_duplicates: dedup.unicode_equivalent_duplicates,
    formatting_duplicates: dedup.formatting_duplicates,
    near_duplicates: dedup.near_duplicate_candidates,
    legitimate_variants: dedup.legitimate_variants,
    unique_items: dedup.unique_items,
    review_items: validation.filter((v) => v.classification === "REVIEW").length,
    invalid_items: validation.filter((v) => v.classification === "INVALID").length,
    silent_deletions: silentDeletions + normalizedMissing,
    provenance_coverage: provenanceCoverage,
    raw_gte_aggregated: rawItems.length >= aggregated.length,
  };
}
