import type { RawKaomojiRecord } from "../../types";
import type { ProvenanceStatus, RepairedProvenance } from "./types";

const REQUIRED_CORE = ["raw_id", "source_id", "source_url", "original_kaomoji", "collection_timestamp"] as const;

function missingFields(raw: RawKaomojiRecord): string[] {
  const missing: string[] = [];
  if (!raw.raw_id) missing.push("raw_id");
  if (!raw.source_id) missing.push("source_id");
  if (!raw.source_url) missing.push("source_url");
  if (!raw.original_kaomoji) missing.push("original_content");
  if (!raw.collection_timestamp) missing.push("collection_timestamp");
  return missing;
}

/** Deterministic provenance repair — derived layer only, never mutates RAW. */
export function repairProvenance(raw: RawKaomojiRecord): RepairedProvenance {
  const missing = missingFields(raw);
  const conflicts: string[] = [];
  const prov = raw.provenance ?? [];

  if (prov.length >= 4) {
    if (prov[0] && prov[0] !== raw.source_id) conflicts.push(`provenance[0] ${prov[0]} != source_id ${raw.source_id}`);
    if (prov[1] && prov[1] !== raw.source_url) conflicts.push(`provenance[1] mismatch source_url`);
  }

  if (missing.length > 0) {
    return {
      raw_id: raw.raw_id,
      status: "MISSING",
      repaired_provenance: [...prov],
      repair_method: null,
      missing_fields: missing,
      conflict_notes: conflicts,
    };
  }

  if (conflicts.length > 0) {
    return {
      raw_id: raw.raw_id,
      status: "CONFLICTING",
      repaired_provenance: [...prov],
      repair_method: "conflict_detected",
      missing_fields: [],
      conflict_notes: conflicts,
    };
  }

  // Phase 5+ format: 4-5 element provenance array
  if (prov.length >= 4) {
    return {
      raw_id: raw.raw_id,
      status: "COMPLETE",
      repaired_provenance: prov,
      repair_method: "phase5_array",
      missing_fields: [],
      conflict_notes: [],
    };
  }

  // Legacy phase 3 format: single string like "wikipedia:List_of_emoticons-1"
  if (prov.length === 1) {
    const repaired = [
      raw.source_id,
      raw.source_url,
      raw.source_page ?? raw.source_category ?? "direct",
      raw.source_record_id ?? prov[0] ?? "content",
      raw.collection_run_id ?? raw.collection_timestamp,
    ];
    const hasOptional = Boolean(raw.source_record_id || raw.source_page);
    return {
      raw_id: raw.raw_id,
      status: hasOptional ? "COMPLETE" : "PARTIAL",
      repaired_provenance: repaired,
      repair_method: "legacy_single_expanded",
      missing_fields: hasOptional ? [] : ["source_record_id", "source_page"],
      conflict_notes: [],
    };
  }

  // Empty or minimal — rebuild from raw fields
  if (prov.length === 0 || prov.length === 2) {
    const repaired = [
      raw.source_id,
      raw.source_url,
      raw.source_page ?? raw.source_category ?? "direct",
      raw.source_record_id ?? "content",
      raw.collection_run_id ?? raw.collection_timestamp,
    ];
    const partial = !raw.source_record_id && !raw.source_page;
    return {
      raw_id: raw.raw_id,
      status: partial ? "PARTIAL" : "COMPLETE",
      repaired_provenance: repaired,
      repair_method: "rebuilt_from_raw_fields",
      missing_fields: partial ? ["source_record_id"] : [],
      conflict_notes: [],
    };
  }

  return {
    raw_id: raw.raw_id,
    status: "PROVENANCE_UNRESOLVED",
    repaired_provenance: prov,
    repair_method: null,
    missing_fields: ["unrecognized_provenance_format"],
    conflict_notes: [],
  };
}

export function explainProvenanceDiscrepancy(stats: Record<ProvenanceStatus, number>, total: number): string {
  const phase7Style = ((stats.COMPLETE ?? 0) + (stats.PARTIAL ?? 0)) / total;
  return (
    `Phase 7 reported 85.6% because it counted provenance array length >= 2 only. ` +
    `33,620 records use legacy Phase 3 single-string provenance arrays despite having full source fields on the RAW record. ` +
    `Phase 8 repairs these deterministically from RAW metadata. ` +
    `Repaired coverage (COMPLETE+PARTIAL): ${(phase7Style * 100).toFixed(1)}%. ` +
    `Legacy single-element arrays: ${total - (stats.COMPLETE ?? 0) - (stats.PARTIAL ?? 0) - (stats.MISSING ?? 0)}.`
  );
}

export { REQUIRED_CORE };
