import {
  isPublishedLocaleCode,
  PUBLISHED_LOCALE_CODES,
  type PublishedLocaleCode,
} from "./locales";

export { PUBLISHED_LOCALE_CODES, type PublishedLocaleCode };

const LOCALIZED_EMOJI_PATH =
  /^\/(es|fr|hi|de|ja|pt)\/emoji\/[^/]+\/?$/;

const PUBLISHED_LOCALE_PATTERN = PUBLISHED_LOCALE_CODES.join("|");

export function parseDocumentLangFromPathname(pathname: string): string {
  const match = pathname.match(new RegExp(`^/(${PUBLISHED_LOCALE_PATTERN})/emoji/`));
  return match?.[1] ?? "en";
}

export function isPublishedLocale(code: string): code is PublishedLocaleCode {
  return isPublishedLocaleCode(code);
}

export function isLocalizedEmojiPath(pathname: string): boolean {
  return LOCALIZED_EMOJI_PATH.test(pathname);
}

/**
 * Search/document language precedence (Phase 17 Part 14):
 * 1. explicit ?lang= (published locale)
 * 2. URL pathname locale
 * 3. English fallback
 */
export function resolveDocumentLang(pathname: string, searchLangParam?: string | null): string {
  if (searchLangParam && isPublishedLocale(searchLangParam)) {
    return searchLangParam;
  }
  const pathLang = parseDocumentLangFromPathname(pathname);
  return pathLang !== "en" ? pathLang : "en";
}

export function buildSearchHref(query: string, language = "en"): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return language !== "en" && isPublishedLocale(language)
      ? `/search?lang=${language}`
      : "/search";
  }
  const params = new URLSearchParams({ q: trimmed });
  if (language !== "en" && isPublishedLocale(language)) {
    params.set("lang", language);
  }
  return `/search?${params.toString()}`;
}
