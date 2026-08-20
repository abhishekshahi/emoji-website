import { mergeLicenseStatuses } from "../sources/license-audit";
import { buildAggregatedId, buildCandidateKey } from "../collection/ids";
import { normalizeKaomoji } from "../normalize/normalize";
import type {
  AggregatedKaomojiRecord,
  RawKaomojiRecord,
  SourceRef,
} from "../types";

function toSourceRef(raw: RawKaomojiRecord): SourceRef {
  return {
    raw_id: raw.raw_id,
    source_id: raw.source_id,
    source_record_id: raw.source_record_id,
    source_page: raw.source_page,
    source_category: raw.source_category,
    license_status: raw.license_status,
  };
}

/** Aggregate raw records by normalized candidate_key; never drop source_refs. */
export function aggregateRawRecords(
  rawRecords: readonly RawKaomojiRecord[],
): AggregatedKaomojiRecord[] {
  const groups = new Map<string, { refs: SourceRef[]; forms: Set<string>; raws: RawKaomojiRecord[] }>();

  for (const raw of rawRecords) {
    const normalized = normalizeKaomoji(raw.original_kaomoji).normalized_kaomoji;
    const candidateKey = buildCandidateKey(normalized);
    let group = groups.get(candidateKey);
    if (!group) {
      group = { refs: [], forms: new Set(), raws: [] };
      groups.set(candidateKey, group);
    }
    group.refs.push(toSourceRef(raw));
    group.forms.add(raw.original_kaomoji);
    group.raws.push(raw);
  }

  const aggregated: AggregatedKaomojiRecord[] = [];

  for (const [candidateKey, group] of groups) {
    const licenseStatuses = group.refs.map((r) => r.license_status);
    const firstSeen = group.raws.reduce(
      (min, r) => (r.first_seen < min ? r.first_seen : min),
      group.raws[0]!.first_seen,
    );
    const lastSeen = group.raws.reduce(
      (max, r) => (r.last_seen > max ? r.last_seen : max),
      group.raws[0]!.last_seen,
    );
    const sourcePages = [
      ...new Set(group.refs.map((r) => r.source_page).filter((p): p is string => p !== null)),
    ];
    const sourceCategories = [
      ...new Set(group.refs.map((r) => r.source_category).filter((c): c is string => c !== null)),
    ];
    const uniqueSourceIds = new Set(group.refs.map((r) => r.source_id));

    aggregated.push({
      aggregated_id: buildAggregatedId(candidateKey),
      candidate_key: candidateKey,
      original_forms: [...group.forms],
      source_refs: group.refs,
      source_count: uniqueSourceIds.size,
      source_pages: sourcePages,
      source_categories: sourceCategories,
      first_seen: firstSeen,
      last_seen: lastSeen,
      license_summary: mergeLicenseStatuses(licenseStatuses),
      processing_status: "aggregated",
    });
  }

  return aggregated.sort((a, b) => a.candidate_key.localeCompare(b.candidate_key));
}
