import type { PublicationStatus, RawKaomojiRecord, RawSourceItem, UniversalContentType } from "../types";
import { classifyContentType } from "./content-type";
import { buildSourceItemId } from "./ids";

function resolvePublicationStatus(licenseStatus: RawKaomojiRecord["license_status"]): PublicationStatus {
  if (licenseStatus === "NOT_PERMITTED") return "PUBLICATION_BLOCKED";
  if (licenseStatus === "REVIEW_REQUIRED" || licenseStatus === "UNKNOWN") return "REVIEW";
  return "PUBLISHABLE";
}

/** Convert Phase 1 kaomoji raw records into universal raw source items without modifying originals. */
export function kaomojiRecordToSourceItem(record: RawKaomojiRecord): RawSourceItem {
  const classification = classifyContentType({
    content: record.original_kaomoji,
    source_id: record.source_id,
    source_category: record.source_category,
  });

  const tags = record.source_category ? [record.source_category] : [];
  const keywords = record.source_title ? [record.source_title] : [];

  return {
    source_item_id: buildSourceItemId(record.raw_id),
    source_id: record.source_id,
    source_url: record.source_url,
    source_page: record.source_page,
    source_category: record.source_category,
    source_subcategory: null,
    content_type: classification.content_type,
    source_content_type: classification.source_content_type,
    original_content: record.original_kaomoji,
    raw_content: record.raw_text,
    source_title: record.source_title,
    source_description: null,
    source_tags: tags,
    source_keywords: keywords,
    source_metadata: {
      source_record_id: record.source_record_id ?? "",
      collector_version: record.collector_version,
    },
    collection_timestamp: record.collection_timestamp,
    collector_version: record.collector_version,
    license_status: record.license_status,
    publication_status: resolvePublicationStatus(record.license_status),
    provenance: [...record.provenance],
    first_seen: record.first_seen,
    last_seen: record.last_seen,
    collection_run_id: record.collection_run_id,
    raw_kaomoji_id: record.raw_id,
  };
}

export function kaomojiRecordsToSourceItems(records: readonly RawKaomojiRecord[]): RawSourceItem[] {
  return records.map(kaomojiRecordToSourceItem);
}

export interface ManualImportEntry {
  readonly original_content: string;
  readonly source_category?: string | null;
  readonly source_page?: string | null;
  readonly source_title?: string | null;
  readonly content_type?: UniversalContentType;
  readonly source_tags?: readonly string[];
}

/** Build a universal raw item from a manual import entry. */
export function manualEntryToSourceItem(
  sourceId: string,
  sourceUrl: string,
  entry: ManualImportEntry,
  licenseStatus: RawKaomojiRecord["license_status"],
  runId: string,
  timestamp: string,
  collectorVersion: string,
): RawSourceItem {
  const classification = classifyContentType({
    content: entry.original_content,
    source_id: sourceId,
    source_category: entry.source_category ?? null,
    override_type: entry.content_type,
  });

  const contentHash = buildSourceItemId(`${sourceId}:${entry.original_content}`);

  return {
    source_item_id: contentHash,
    source_id: sourceId,
    source_url: sourceUrl,
    source_page: entry.source_page ?? null,
    source_category: entry.source_category ?? null,
    source_subcategory: null,
    content_type: classification.content_type,
    source_content_type: classification.source_content_type,
    original_content: entry.original_content,
    raw_content: entry.original_content,
    source_title: entry.source_title ?? null,
    source_description: null,
    source_tags: entry.source_tags ?? [],
    source_keywords: [],
    source_metadata: { import: "manual" },
    collection_timestamp: timestamp,
    collector_version: collectorVersion,
    license_status: licenseStatus,
    publication_status: resolvePublicationStatus(licenseStatus),
    provenance: [`${sourceId}:manual:${contentHash}`],
    first_seen: timestamp,
    last_seen: timestamp,
    collection_run_id: runId,
    raw_kaomoji_id: null,
  };
}
