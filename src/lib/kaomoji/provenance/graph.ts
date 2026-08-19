import type { AggregatedKaomojiRecord, ProvenanceRecord } from "../types";

/** Build provenance graph entries from aggregated records. */
export function buildProvenanceGraph(
  aggregatedRecords: readonly AggregatedKaomojiRecord[],
): ProvenanceRecord[] {
  return aggregatedRecords.map((record) => {
    const rawIds = record.source_refs.map((ref) => ref.raw_id);
    const sourceIds = [...new Set(record.source_refs.map((ref) => ref.source_id))];
    const licenseStatuses = [...new Set(record.source_refs.map((ref) => ref.license_status))];

    const chain: string[] = [];
    for (const ref of record.source_refs) {
      chain.push(`${ref.source_id}:${ref.raw_id}`);
    }

    return {
      aggregated_id: record.aggregated_id,
      raw_ids: rawIds,
      source_ids: sourceIds,
      license_statuses: licenseStatuses,
      chain,
    };
  });
}
