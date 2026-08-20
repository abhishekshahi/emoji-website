import { createHash } from "node:crypto";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface RawIdInput {
  readonly source_id: string;
  readonly source_record_id: string | null;
  readonly original_kaomoji: string;
}

export interface OccurrenceRawIdInput {
  readonly source_id: string;
  readonly source_record_id: string | null;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly source_file: string | null;
  readonly occurrence_index?: number;
}

/** Phase 5: occurrence-preserving raw_id — never collapses category/page duplicates. */
export function buildOccurrenceRawId(input: OccurrenceRawIdInput): string {
  const parts = [
    input.source_id,
    input.source_record_id ?? "",
    input.source_page ?? "",
    input.source_category ?? "",
    input.source_file ?? "",
    input.occurrence_index != null ? String(input.occurrence_index) : "",
  ].join("|");
  return sha256Hex(`occurrence:${parts}`);
}

/** Deterministic raw_id from source_id + source_record_id, or content hash fallback. */
export function buildRawId(input: RawIdInput): string {
  const { source_id, source_record_id, original_kaomoji } = input;
  if (source_record_id) {
    return sha256Hex(`${source_id}:${source_record_id}`);
  }
  return sha256Hex(`${source_id}:content:${original_kaomoji}`);
}

/** Candidate grouping key derived from the normalized kaomoji form. */
export function buildCandidateKey(normalizedKaomoji: string): string {
  return normalizedKaomoji;
}

/** Stable aggregated_id from candidate_key hash. */
export function buildAggregatedId(candidateKey: string): string {
  return sha256Hex(`candidate:${candidateKey}`);
}
