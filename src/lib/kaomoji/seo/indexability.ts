import type { KaomojiEditorialRecord } from "../processing/phase9/types";

export interface KaomojiIndexabilityResult {
  readonly indexable: boolean;
  readonly reason: string;
}

export function assessKaomojiIndexability(record: KaomojiEditorialRecord): KaomojiIndexabilityResult {
  if (!record.is_public) return { indexable: false, reason: "not_public" };
  if (!record.slug?.trim()) return { indexable: false, reason: "missing_slug" };
  if (!record.canonical_content?.trim()) return { indexable: false, reason: "missing_content" };
  if (!record.seo_title?.trim()) return { indexable: false, reason: "missing_seo_title" };
  if (!record.seo_description?.trim()) return { indexable: false, reason: "missing_seo_description" };
  if (record.license_status === "NOT_PERMITTED") return { indexable: false, reason: "license_not_permitted" };
  return { indexable: true, reason: "public_quality_gate" };
}

export function isKaomojiIndexable(record: KaomojiEditorialRecord): boolean {
  return assessKaomojiIndexability(record).indexable;
}

export function countIndexableKaomoji(records: readonly KaomojiEditorialRecord[]): number {
  return records.filter(isKaomojiIndexable).length;
}
