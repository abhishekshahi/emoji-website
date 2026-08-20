import type {
  AggregatedSourceItem,
  RawSourceItem,
  SourceCoverageMatrix,
  SourceCoverageRow,
  UniversalValidationRecord,
} from "../types";
import { KAOMOJI_SOURCE_REGISTRY } from "../sources/registry";

/** Build source coverage matrix across all 10 sources. */
export function buildSourceCoverageMatrix(
  rawItems: readonly RawSourceItem[],
  aggregated: readonly AggregatedSourceItem[],
  validation: readonly UniversalValidationRecord[],
): SourceCoverageMatrix {
  const validationByAgg = new Map(validation.map((v) => [v.aggregated_id, v]));

  const rows: SourceCoverageRow[] = KAOMOJI_SOURCE_REGISTRY.map((source) => {
    const sourceRaw = rawItems.filter((r) => r.source_id === source.source_id);
    const unique = new Set(sourceRaw.map((r) => r.original_content)).size;
    let aggregatedCount = 0;
    let duplicate = 0;

    for (const agg of aggregated) {
      const refs = agg.source_refs.filter((r) => r.source_id === source.source_id);
      if (refs.length > 0) aggregatedCount += 1;
      if (refs.length > 0 && agg.source_refs.length > 1) duplicate += refs.length - 1;
    }

    let review = 0;
    let invalid = 0;
    for (const agg of aggregated) {
      if (!agg.source_refs.some((r) => r.source_id === source.source_id)) continue;
      const v = validationByAgg.get(agg.aggregated_id);
      if (v?.classification === "REVIEW") review += 1;
      if (v?.classification === "INVALID") invalid += 1;
    }

    return {
      source_id: source.source_id,
      raw: sourceRaw.length,
      unique,
      aggregated: aggregatedCount,
      duplicate,
      review,
      invalid,
    };
  });

  let sourceOnly = 0;
  let shared2 = 0;
  let shared3 = 0;
  let shared4Plus = 0;

  for (const agg of aggregated) {
    if (agg.source_count === 1) sourceOnly += 1;
    else if (agg.source_count === 2) shared2 += 1;
    else if (agg.source_count === 3) shared3 += 1;
    else if (agg.source_count >= 4) shared4Plus += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    rows,
    source_only_records: sourceOnly,
    shared_by_2: shared2,
    shared_by_3: shared3,
    shared_by_4_plus: shared4Plus,
  };
}
