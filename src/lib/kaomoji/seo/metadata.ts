import type { SupportedLanguage } from "@/lib/content/localization/types";
import type { KaomojiEditorialRecord } from "../processing/phase9/types";
import { localizedKaomojiPath } from "../localization/paths";
import { getKaomojiUiStrings } from "../localization/registry";

export interface KaomojiPageMetadataInput {
  readonly record: KaomojiEditorialRecord;
  readonly locale?: SupportedLanguage;
}

export function buildKaomojiPageTitle(record: KaomojiEditorialRecord): string {
  return record.seo_title;
}

export function buildKaomojiPageDescription(record: KaomojiEditorialRecord): string {
  return record.seo_description;
}

export function buildKaomojiPagePath(record: KaomojiEditorialRecord, locale: SupportedLanguage = "en"): string {
  return localizedKaomojiPath(locale, record.slug);
}

export function buildKaomojiOpenGraph(record: KaomojiEditorialRecord, locale: SupportedLanguage = "en") {
  const ui = getKaomojiUiStrings(locale);
  return {
    title: buildKaomojiPageTitle(record),
    description: buildKaomojiPageDescription(record),
    path: buildKaomojiPagePath(record, locale),
    type: "website" as const,
    siteName: "EmojiQuick",
    altText: record.accessible_name || ui.copy,
  };
}
