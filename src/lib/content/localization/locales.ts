import type { SupportedLanguage } from "./types";

export type LocaleDirection = "ltr" | "rtl";

export type LocalePublicationStatus = "published" | "keywords-only" | "planned";

export interface LocaleDefinition {
  readonly code: SupportedLanguage;
  readonly name: string;
  readonly nativeName: string;
  readonly hreflang: string;
  readonly direction: LocaleDirection;
  readonly fallback: SupportedLanguage;
  readonly publicationStatus: LocalePublicationStatus;
  readonly seoName: string;
}

/** Single authoritative locale registry — import everywhere, do not duplicate lists. */
export const LOCALE_REGISTRY: Readonly<Record<SupportedLanguage, LocaleDefinition>> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    hreflang: "en",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "English",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    hreflang: "es",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "Spanish",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    hreflang: "fr",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "French",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    hreflang: "de",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "German",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    hreflang: "hi",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "Hindi",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    hreflang: "pt",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "Portuguese",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    hreflang: "ja",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "published",
    seoName: "Japanese",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    hreflang: "it",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "keywords-only",
    seoName: "Italian",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    hreflang: "ko",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "planned",
    seoName: "Korean",
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    hreflang: "zh",
    direction: "ltr",
    fallback: "en",
    publicationStatus: "planned",
    seoName: "Chinese",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    hreflang: "ar",
    direction: "rtl",
    fallback: "en",
    publicationStatus: "planned",
    seoName: "Arabic",
  },
};

export const PUBLISHED_LOCALE_CODES = Object.values(LOCALE_REGISTRY)
  .filter((l) => l.publicationStatus === "published" && l.code !== "en")
  .map((l) => l.code) as readonly Exclude<SupportedLanguage, "en">[];

export type PublishedLocaleCode = (typeof PUBLISHED_LOCALE_CODES)[number];

export function getLocale(code: string): LocaleDefinition | null {
  return LOCALE_REGISTRY[code as SupportedLanguage] ?? null;
}

export function getPublishedLocales(): readonly LocaleDefinition[] {
  return PUBLISHED_LOCALE_CODES.map((code) => LOCALE_REGISTRY[code]);
}

export function isPublishedLocaleCode(code: string): code is PublishedLocaleCode {
  return (PUBLISHED_LOCALE_CODES as readonly string[]).includes(code);
}

export function getLocaleDirection(code: string): LocaleDirection {
  return getLocale(code)?.direction ?? "ltr";
}
