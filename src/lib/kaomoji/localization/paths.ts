import { LOCALE_REGISTRY } from "@/lib/content/localization/locales";
import { PRIMARY_LANGUAGE, type SupportedLanguage } from "@/lib/content/localization/types";

const SITE_ORIGIN = "https://emojiquick.com";

export function localizedKaomojiPath(language: SupportedLanguage, slug?: string): string {
  const base = language === PRIMARY_LANGUAGE ? "/kaomoji" : `/${language}/kaomoji`;
  return slug ? `${base}/${slug}` : base;
}

export interface KaomojiHreflangAlternate {
  readonly hreflang: string;
  readonly href: string;
}

export function kaomojiHreflangAlternates(slug: string): readonly KaomojiHreflangAlternate[] {
  const languages = Object.keys(LOCALE_REGISTRY) as SupportedLanguage[];
  return languages.map((code) => ({
    hreflang: LOCALE_REGISTRY[code].hreflang,
    href: `${SITE_ORIGIN}${localizedKaomojiPath(code, slug)}`,
  }));
}

export function kaomojiListingHreflangAlternates(): readonly KaomojiHreflangAlternate[] {
  const languages = Object.keys(LOCALE_REGISTRY) as SupportedLanguage[];
  return languages.map((code) => ({
    hreflang: LOCALE_REGISTRY[code].hreflang,
    href: `${SITE_ORIGIN}${localizedKaomojiPath(code)}`,
  }));
}