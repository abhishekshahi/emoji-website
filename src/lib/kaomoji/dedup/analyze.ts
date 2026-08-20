import { DEDUP_ALGORITHM_VERSION } from "../storage/paths";
import { formattingKey, unicodeEquivalentKey } from "../universal/normalize";
import type {
  AggregatedSourceItem,
  DedupAnalysisReport,
  DedupClass,
  DeduplicationRecord,
} from "../types";

function assignDedupClass(
  item: AggregatedSourceItem,
  exactGroups: Map<string, AggregatedSourceItem[]>,
  unicodeGroups: Map<string, AggregatedSourceItem[]>,
  formatGroups: Map<string, AggregatedSourceItem[]>,
): DedupClass {
  if (item.source_refs.length > 1) return "EXACT_DUPLICATE";

  const exactKey = `${item.content_type}:${item.canonical_candidate}`;
  if ((exactGroups.get(exactKey)?.length ?? 0) > 1) return "EXACT_DUPLICATE";

  const unicodeKey = `${item.content_type}:${unicodeEquivalentKey(item.canonical_candidate)}`;
  if ((unicodeGroups.get(unicodeKey)?.length ?? 0) > 1) return "UNICODE_EQUIVALENT";

  const formatKey = `${item.content_type}:${formattingKey(item.canonical_candidate)}`;
  const formatSiblings = formatGroups.get(formatKey) ?? [];
  if (formatSiblings.length > 1) {
    const distinctCanonical = new Set(formatSiblings.map((s) => s.canonical_candidate));
    if (distinctCanonical.size > 1) return "FORMATTING_DUPLICATE";
  }

  return "UNIQUE";
}

/** Analyze deduplication levels without removing legitimate variants. */
export function analyzeDeduplication(
  aggregated: readonly AggregatedSourceItem[],
): DedupAnalysisReport {
  const exactGroups = new Map<string, AggregatedSourceItem[]>();
  const unicodeGroups = new Map<string, AggregatedSourceItem[]>();
  const formatGroups = new Map<string, AggregatedSourceItem[]>();

  for (const item of aggregated) {
    const exactKey = `${item.content_type}:${item.canonical_candidate}`;
    const unicodeKey = `${item.content_type}:${unicodeEquivalentKey(item.canonical_candidate)}`;
    const formatKey = `${item.content_type}:${formattingKey(item.canonical_candidate)}`;

    for (const [map, key] of [
      [exactGroups, exactKey],
      [unicodeGroups, unicodeKey],
      [formatGroups, formatKey],
    ] as const) {
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
  }

  const mergeEntries: DeduplicationRecord[] = [];
  let exactDuplicates = 0;
  let unicodeEquivalent = 0;
  let formattingDuplicates = 0;
  let nearDuplicateCandidates = 0;
  let legitimateVariants = 0;
  let uniqueItems = 0;

  for (const item of aggregated) {
    const dedupClass = assignDedupClass(item, exactGroups, unicodeGroups, formatGroups);

    if (dedupClass === "EXACT_DUPLICATE") {
      if (item.source_refs.length > 1) {
        exactDuplicates += item.source_refs.length - 1;
        mergeEntries.push({
          merged_record: item.aggregated_id,
          source_records: item.source_refs.map((r) => r.source_item_id),
          deduplication_level: "exact",
          dedup_class: dedupClass,
          reason: "multi_source_exact_match",
          confidence: "high",
          algorithm_version: DEDUP_ALGORITHM_VERSION,
        });
      }
    } else if (dedupClass === "UNICODE_EQUIVALENT") {
      unicodeEquivalent += 1;
    } else if (dedupClass === "FORMATTING_DUPLICATE") {
      formattingDuplicates += 1;
    } else if (dedupClass === "POTENTIAL_NEAR_DUPLICATE") {
      nearDuplicateCandidates += 1;
    } else if (dedupClass === "LEGITIMATE_VARIANT") {
      legitimateVariants += 1;
    } else {
      uniqueItems += 1;
    }
  }

  const formatVariantGroups = [...formatGroups.values()].filter((g) => {
    const distinct = new Set(g.map((i) => i.canonical_candidate));
    return g.length > 1 && distinct.size > 1;
  });
  legitimateVariants += formatVariantGroups.reduce((sum, g) => sum + g.length, 0);

  return {
    generated_at: new Date().toISOString(),
    algorithm_version: DEDUP_ALGORITHM_VERSION,
    exact_duplicates: exactDuplicates,
    unicode_equivalent_duplicates: unicodeEquivalent,
    formatting_duplicates: formattingDuplicates,
    near_duplicate_candidates: nearDuplicateCandidates,
    legitimate_variants: legitimateVariants,
    unique_items: uniqueItems,
    merge_entries: mergeEntries,
  };
}

export function applyDedupClasses(
  aggregated: readonly AggregatedSourceItem[],
  report: DedupAnalysisReport,
): AggregatedSourceItem[] {
  const mergeMap = new Map<string, DedupClass>();
  for (const entry of report.merge_entries) {
    mergeMap.set(entry.merged_record, entry.dedup_class);
  }

  const exactGroups = new Map<string, AggregatedSourceItem[]>();
  const unicodeGroups = new Map<string, AggregatedSourceItem[]>();
  const formatGroups = new Map<string, AggregatedSourceItem[]>();
  for (const item of aggregated) {
    exactGroups.set(`${item.content_type}:${item.canonical_candidate}`, [
      ...(exactGroups.get(`${item.content_type}:${item.canonical_candidate}`) ?? []),
      item,
    ]);
    unicodeGroups.set(`${item.content_type}:${unicodeEquivalentKey(item.canonical_candidate)}`, [
      ...(unicodeGroups.get(`${item.content_type}:${unicodeEquivalentKey(item.canonical_candidate)}`) ?? []),
      item,
    ]);
    formatGroups.set(`${item.content_type}:${formattingKey(item.canonical_candidate)}`, [
      ...(formatGroups.get(`${item.content_type}:${formattingKey(item.canonical_candidate)}`) ?? []),
      item,
    ]);
  }

  return aggregated.map((item) => ({
    ...item,
    dedup_class: mergeMap.get(item.aggregated_id) ?? assignDedupClass(item, exactGroups, unicodeGroups, formatGroups),
  }));
}
