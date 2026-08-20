import { normalizeKaomoji } from "../normalize/normalize";
import type { NormalizedSourceItem } from "../types";
import type { AggregatedSourceItem } from "../types";

/** Normalize universal content without modifying original_content on source items. */
export function normalizeSourceItem(aggregated: AggregatedSourceItem): NormalizedSourceItem {
  const primary = aggregated.original_forms[0] ?? aggregated.canonical_candidate;
  const result = normalizeKaomoji(primary);

  const identityChanged =
    result.normalized_kaomoji !== primary &&
    result.normalization_changes.some((c) => c.kind === "unicode");

  return {
    aggregated_id: aggregated.aggregated_id,
    original_content: primary,
    normalized_content: result.normalized_kaomoji,
    normalization_version: result.normalization_version,
    normalization_method: "phase2-universal-nfc-html-line-ending",
    normalization_changes: result.normalization_changes,
    normalization_warnings: result.normalization_warnings,
    flag_review: identityChanged,
  };
}

export function normalizeSourceItems(
  aggregated: readonly AggregatedSourceItem[],
): NormalizedSourceItem[] {
  return aggregated.map(normalizeSourceItem);
}

/** Formatting-only normalization for dedup comparison (does not mutate stored originals). */
export function formattingKey(content: string): string {
  return content.replace(/\s+/g, "").normalize("NFC");
}

/** Unicode-equivalence key (NFKC) for dedup analysis only. */
export function unicodeEquivalentKey(content: string): string {
  return content.normalize("NFKC");
}
