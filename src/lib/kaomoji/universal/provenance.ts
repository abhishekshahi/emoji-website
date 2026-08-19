import type { AggregatedSourceItem, UniversalProvenanceRecord } from "../types";

/** Build universal provenance graph from aggregated source items. */
export function buildUniversalProvenanceGraph(
  aggregated: readonly AggregatedSourceItem[],
): UniversalProvenanceRecord[] {
  return aggregated.map((record) => {
    const sourceItemIds = record.source_refs.map((ref) => ref.source_item_id);
    const sourceIds = [...new Set(record.source_refs.map((ref) => ref.source_id))];
    const licenseStatuses = [...new Set(record.source_refs.map((ref) => ref.license_status))];
    const chain: string[] = [];
    for (const ref of record.source_refs) {
      chain.push(`${ref.source_id}:${ref.source_item_id}`);
    }
    return {
      aggregated_id: record.aggregated_id,
      source_item_ids: sourceItemIds,
      source_ids: sourceIds,
      license_statuses: licenseStatuses,
      chain,
    };
  });
}

export function computeProvenanceCoverage(
  rawItemCount: number,
  provenance: readonly UniversalProvenanceRecord[],
): number {
  if (rawItemCount === 0) return 1;
  const refs = provenance.reduce((sum, p) => sum + p.source_item_ids.length, 0);
  return refs / rawItemCount;
}
