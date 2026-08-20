import type { ContentProvenance } from "../types";

export type SupportedLanguage =
  | "en"
  | "hi"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ja"
  | "ko"
  | "zh"
  | "ar";

export const PRIMARY_LANGUAGE: SupportedLanguage = "en";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  "en",
  "hi",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "ja",
  "ko",
  "zh",
  "ar",
] as const;

export interface LocalizedEmojiContent {
  readonly canonicalId: string;
  readonly language: SupportedLanguage;
  readonly localizedName?: string;
  readonly shortDescription?: string;
  readonly meaning?: string;
  readonly usage?: string;
  readonly keywords?: readonly string[];
  readonly aliases?: readonly string[];
  readonly provenance: ContentProvenance;
}

/** URL strategy: /{locale}/emoji/{slug} when localized content is published. */
export function localizedEmojiPath(language: SupportedLanguage, slug: string): string {
  if (language === PRIMARY_LANGUAGE) return `/emoji/${slug}`;
  return `/${language}/emoji/${slug}`;
}
