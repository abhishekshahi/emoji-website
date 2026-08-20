import { mergeLicenseStatuses } from "../sources/license-audit";
import { classifyContentType } from "./content-type";
import { buildUniversalAggregatedId, buildUniversalCandidateKey } from "./ids";
import { formattingKey, normalizeSourceItem } from "./normalize";
import type {
  AggregatedSourceItem,
  DedupClass,
  RawSourceItem,
  UniversalSourceRef,
} from "../types";

function toUniversalSourceRef(item: RawSourceItem): UniversalSourceRef {
  return {
    source_item_id: item.source_item_id,
    source_id: item.source_id,
    source_page: item.source_page,
    source_category: item.source_category,
    license_status: item.license_status,
    publication_status: item.publication_status,
  };
}

function resolvePublicationStatus(refs: UniversalSourceRef[]): AggregatedSourceItem["publication_status"] {
  const statuses = refs.map((r) => r.publication_status);
  if (statuses.includes("PUBLICATION_BLOCKED")) return "PUBLICATION_BLOCKED";
  if (statuses.includes("REVIEW")) return "REVIEW";
  return "PUBLISHABLE";
}

/** Aggregate universal raw items by content_type + normalized candidate key. */
export function aggregateSourceItems(rawItems: readonly RawSourceItem[]): AggregatedSourceItem[] {
  const groups = new Map<
    string,
    { refs: UniversalSourceRef[]; forms: Set<string>; items: RawSourceItem[] }
  >();

  for (const item of rawItems) {
    const norm = normalizeSourceItem({
      aggregated_id: "pending",
      content_type: item.content_type,
      normalized_content_type: item.content_type,
      classification_confidence: "medium",
      canonical_candidate: item.original_content,
      original_forms: [item.original_content],
      source_refs: [],
      source_count: 0,
      source_urls: [],
      source_categories: [],
      source_metadata: {},
      first_seen: item.first_seen,
      last_seen: item.last_seen,
      license_summary: item.license_status,
      publication_status: item.publication_status,
      processing_status: "raw",
      dedup_class: "UNIQUE",
    });
    const candidateKey = buildUniversalCandidateKey(norm.normalized_content);
    let group = groups.get(candidateKey);
    if (!group) {
      group = { refs: [], forms: new Set(), items: [] };
      groups.set(candidateKey, group);
    }
    group.refs.push(toUniversalSourceRef(item));
    group.forms.add(item.original_content);
    group.items.push(item);
  }

  const aggregated: AggregatedSourceItem[] = [];

  for (const [candidateKey, group] of groups) {
    const contentType = group.items[0]!.content_type;
    const classification = classifyContentType({
      content: group.items[0]!.original_content,
      source_id: group.items[0]!.source_id,
      source_category: group.items[0]!.source_category,
    });
    const uniqueSourceIds = new Set(group.refs.map((r) => r.source_id));
    const sourceUrls = [...new Set(group.items.map((i) => i.source_url))];
    const sourceCategories = [
      ...new Set(group.items.map((i) => i.source_category).filter((c): c is string => c !== null)),
    ];
    const firstSeen = group.items.reduce(
      (min, r) => (r.first_seen < min ? r.first_seen : min),
      group.items[0]!.first_seen,
    );
    const lastSeen = group.items.reduce(
      (max, r) => (r.last_seen > max ? r.last_seen : max),
      group.items[0]!.last_seen,
    );
    const dedupClass: DedupClass = group.refs.length > 1 ? "EXACT_DUPLICATE" : "UNIQUE";

    aggregated.push({
      aggregated_id: buildUniversalAggregatedId(candidateKey, contentType),
      content_type: contentType,
      normalized_content_type: classification.content_type,
      classification_confidence: classification.confidence,
      canonical_candidate: candidateKey,
      original_forms: [...group.forms],
      source_refs: group.refs,
      source_count: uniqueSourceIds.size,
      source_urls: sourceUrls,
      source_categories: sourceCategories,
      source_metadata: {},
      first_seen: firstSeen,
      last_seen: lastSeen,
      license_summary: mergeLicenseStatuses(group.refs.map((r) => r.license_status)),
      publication_status: resolvePublicationStatus(group.refs),
      processing_status: "aggregated",
      dedup_class: dedupClass,
    });
  }

  return aggregated.sort((a, b) => a.aggregated_id.localeCompare(b.aggregated_id));
}

/** Detect formatting variants across aggregated items (both survive; flagged for audit). */
export function detectFormattingVariants(
  aggregated: readonly AggregatedSourceItem[],
): Map<string, AggregatedSourceItem[]> {
  const byFormat = new Map<string, AggregatedSourceItem[]>();
  for (const item of aggregated) {
    const key = `${item.content_type}:${formattingKey(item.canonical_candidate)}`;
    const list = byFormat.get(key) ?? [];
    list.push(item);
    byFormat.set(key, list);
  }
  return byFormat;
}
