import { loadEditorialRecords } from "../product/loader";
import type { KaomojiEditorialRecord } from "../processing/phase9/types";

export interface CategoryPageItem {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly name: string | null;
  readonly accessible_name: string;
}

export interface CategoryPageData {
  readonly categorySlug: string;
  readonly label: string;
  readonly group: string;
  readonly itemCount: number;
  readonly items: readonly CategoryPageItem[];
}

function mapRecord(r: KaomojiEditorialRecord): CategoryPageItem {
  return {
    canonical_id: r.canonical_id,
    slug: r.slug,
    content: r.canonical_content,
    name: r.editorial_name,
    accessible_name: r.accessible_name,
  };
}

export function countCategoryRecordsLocal(categorySlug: string): number {
  return loadEditorialRecords().filter(
    (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === categorySlug),
  ).length;
}

export function getCategoryPageDataLocal(categorySlug: string, limit = 48): CategoryPageData | null {
  const records = loadEditorialRecords()
    .filter((r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === categorySlug))
    .sort((a, b) => b.quality_score - a.quality_score || a.slug.localeCompare(b.slug));
  if (records.length === 0) return null;
  const sample = records[0]!;
  const primary = sample.emojiquick_categories.find((c) => c.slug === categorySlug) ?? sample.emojiquick_categories[0]!;
  return {
    categorySlug,
    label: primary.label,
    group: primary.group,
    itemCount: records.length,
    items: records.slice(0, limit).map(mapRecord),
  };
}
