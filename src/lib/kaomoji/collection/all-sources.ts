import { existsSync } from "node:fs";
import { KAOMOJI_SOURCE_REGISTRY } from "../sources/registry";
import { getImportFilePath } from "../storage/paths";
import type {
  CollectionStatus,
  RawKaomojiRecord,
  RawSourceItem,
  SourceCollectionReport,
} from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Build per-source collection reports for all 10 registered sources. */
export function buildAllSourceReports(
  rootDir: string,
  rawKaomoji: readonly RawKaomojiRecord[],
  rawItems: readonly RawSourceItem[],
): SourceCollectionReport[] {
  const started = nowIso();

  return KAOMOJI_SOURCE_REGISTRY.map((source) => {
    const kaomojiForSource = rawKaomoji.filter((r) => r.source_id === source.source_id);
    const itemsForSource = rawItems.filter((r) => r.source_id === source.source_id);
    const categories = [
      ...new Set(
        itemsForSource.map((i) => i.source_category).filter((c): c is string => c !== null),
      ),
    ];
    const uniqueOriginals = new Set(itemsForSource.map((i) => i.original_content)).size;
    const errors: string[] = [];
    const warnings: string[] = [];

    let collectionStatus: CollectionStatus;

    if (source.enabled_for_collection) {
      collectionStatus = kaomojiForSource.length > 0 ? "collected" : "skipped";
      if (kaomojiForSource.length === 0) {
        warnings.push("collection enabled but zero records collected");
      }
    } else if (source.collection_method === "documented_import" || source.collection_method === "manual_import") {
      const importPath = getImportFilePath(rootDir, source.source_id);
      if (existsSync(importPath)) {
        collectionStatus = itemsForSource.length > 0 ? "collected" : "manual_required";
        if (itemsForSource.length === 0) {
          warnings.push("import file exists but no records loaded");
        }
      } else {
        collectionStatus = "manual_required";
        warnings.push("manual import file not present");
      }
    } else if (source.license_status === "NOT_PERMITTED") {
      collectionStatus = "not_permitted";
    } else {
      collectionStatus = "manual_required";
      warnings.push("license review required before collection");
    }

    if (source.license_status === "REVIEW_REQUIRED") {
      warnings.push("license_status REVIEW_REQUIRED — publication blocked until verified");
    }

    return {
      source_id: source.source_id,
      collection_status: collectionStatus,
      collection_method: source.collection_method,
      collection_started: started,
      collection_completed: nowIso(),
      raw_record_count: itemsForSource.length,
      unique_raw_count: uniqueOriginals,
      pages_processed: categories.length,
      categories_found: categories,
      errors,
      warnings,
      license_status: source.license_status,
    };
  });
}
