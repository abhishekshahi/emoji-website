import type { SupportedLanguage } from "@/lib/content/localization/types";

export type KaomojiLocaleConfidence = "HIGH" | "CONTROLLED" | "REVIEW_REQUIRED";

export type KaomojiLocaleStatus = "PUBLISHED" | "REVIEW_REQUIRED" | "MISSING";

export interface LocalizedSearchTerm {
  readonly locale: SupportedLanguage;
  readonly term: string;
  readonly englishTokens: readonly string[];
  readonly confidence: KaomojiLocaleConfidence;
}

export interface KaomojiUiStrings {
  readonly searchPlaceholder: string;
  readonly searchButton: string;
  readonly emptyResults: string;
  readonly loading: string;
  readonly copy: string;
  readonly copied: string;
  readonly favorite: string;
  readonly favorited: string;
  readonly share: string;
  readonly relatedHeading: string;
  readonly keywordsHeading: string;
}

export interface KaomojiLocaleBundle {
  readonly locale: SupportedLanguage;
  readonly status: KaomojiLocaleStatus;
  readonly ui: KaomojiUiStrings;
  readonly categoryLabels: Readonly<Record<string, string>>;
}

export interface Phase15LocaleRegistry {
  readonly version: string;
  readonly primaryLocale: SupportedLanguage;
  readonly supportedLocales: readonly SupportedLanguage[];
  readonly bundles: readonly KaomojiLocaleBundle[];
  readonly localizedSearchTerms: readonly LocalizedSearchTerm[];
}
