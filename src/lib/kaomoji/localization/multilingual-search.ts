import type { SupportedLanguage } from "@/lib/content/localization/types";
import { SEARCH_INTENT_TERMS } from "../processing/phase9/keywords";
import { normalizeSearchQuery } from "../processing/phase14/query-normalizer";
import { detectQueryLanguage, isAutoLocale } from "./language-detect";
import {
  LOCALIZED_SEARCH_TERMS,
  lookupLocalizedEnglishTokens,
  resolveLocalizedSearchQuery,
  type KaomojiSearchLocaleHint,
} from "./search-terms";
import type { LocalizedSearchTerm } from "./types";

export type { KaomojiSearchLocaleHint } from "./search-terms";

export interface MultilingualSearchResolution {
  readonly originalQuery: string;
  readonly resolvedQuery: string;
  readonly detectedLocale: SupportedLanguage | null;
  readonly localeHint: KaomojiSearchLocaleHint;
  readonly usedFallback: boolean;
  readonly mappedTerms: readonly string[];
}

export interface MultilingualSearchSuggestion {
  readonly term: string;
  readonly locale: SupportedLanguage | "en";
  readonly label: string;
  readonly englishTokens: readonly string[];
}

const EN_SUGGESTIONS: readonly MultilingualSearchSuggestion[] = SEARCH_INTENT_TERMS.map((term) => ({
  term,
  locale: "en" as const,
  label: term,
  englishTokens: [term],
}));

function localizedSuggestions(): readonly MultilingualSearchSuggestion[] {
  return LOCALIZED_SEARCH_TERMS.map((entry) => ({
    term: entry.term,
    locale: entry.locale,
    label: entry.term,
    englishTokens: entry.englishTokens,
  }));
}

function resolveToken(token: string, preferredLocales: readonly SupportedLanguage[]): string[] {
  const normalized = token.normalize("NFC").trim().toLowerCase();
  if (!normalized) return [];

  const out = new Set<string>([normalized]);

  for (const locale of preferredLocales) {
    const mapped = lookupLocalizedEnglishTokens(normalized, locale);
    if (mapped.length > 0) {
      for (const english of mapped) out.add(english);
      return [...out];
    }
  }

  for (const locale of preferredLocales) {
    if (locale === "en") continue;
    const mapped = lookupLocalizedEnglishTokens(normalized, locale);
    for (const english of mapped) out.add(english);
  }

  return [...out];
}

/** Resolve mixed-language queries into English taxonomy tokens for the existing search index. */
export function resolveMultilingualSearchQuery(
  query: string,
  localeHint: KaomojiSearchLocaleHint = "auto",
): MultilingualSearchResolution {
  const parsed = normalizeSearchQuery(query);
  let detected: SupportedLanguage | null = detectQueryLanguage(parsed.original);
  if (!isAutoLocale(localeHint)) {
    detected = localeHint as SupportedLanguage;
  }
  const preferredLocales: SupportedLanguage[] = detected
    ? [detected, "en"]
    : ["en", "hi", "es", "fr", "de", "pt", "it", "ja", "ko", "zh", "ar"];

  const mappedTerms = new Set<string>();
  const tokenSources =
    parsed.tokens.length > 0
      ? [...parsed.tokens]
      : parsed.normalized.length >= 1
        ? [parsed.normalized]
        : [];

  if (detected && parsed.normalized) {
    const full = resolveLocalizedSearchQuery(parsed.normalized, detected);
    for (const token of full.split(/\s+/)) {
      if (token.length >= 1) mappedTerms.add(token);
    }
  }

  for (const token of tokenSources) {
    for (const resolved of resolveToken(token, preferredLocales)) {
      if (resolved.length >= 1) mappedTerms.add(resolved);
    }
  }

  const resolvedTokens = [...mappedTerms].filter((t) => t !== "kaomoji" && t !== "emoticon");
  const resolvedQuery =
    resolvedTokens.length > 0
      ? resolvedTokens.join(" ")
      : localeHint !== "auto" && localeHint !== "en"
        ? resolveLocalizedSearchQuery(parsed.normalized, localeHint)
        : parsed.normalized;

  const usedFallback =
    Boolean(detected || (localeHint !== "auto" && localeHint !== "en")) &&
    resolvedQuery === parsed.normalized &&
    parsed.normalized.length > 0 &&
    !LOCALIZED_SEARCH_TERMS.some(
      (entry: LocalizedSearchTerm) =>
        entry.term.toLowerCase() === parsed.normalized ||
        parsed.tokens.some((t) => t === entry.term.toLowerCase()),
    );

  return {
    originalQuery: parsed.original,
    resolvedQuery,
    detectedLocale: detected,
    localeHint,
    usedFallback,
    mappedTerms: resolvedTokens,
  };
}

/** Authoritative multilingual suggestions — taxonomy only, never user-generated. */
export function getMultilingualSearchSuggestions(
  query: string,
  localeHint: KaomojiSearchLocaleHint = "auto",
  limit = 8,
): readonly MultilingualSearchSuggestion[] {
  const parsed = normalizeSearchQuery(query);
  const needle = parsed.normalized;
  if (!needle) {
    const locale = !isAutoLocale(localeHint) ? localeHint : "en";
    const pool = locale === "en"
      ? EN_SUGGESTIONS
      : localizedSuggestions().filter((s) => s.locale === locale || s.locale === "en");
    return pool.slice(0, limit);
  }

  const detected = !isAutoLocale(localeHint) ? localeHint : detectQueryLanguage(parsed.original);
  const pool = [...EN_SUGGESTIONS, ...localizedSuggestions()];
  const ranked = pool
    .filter((s) => s.term.includes(needle) || s.label.includes(needle) || s.englishTokens.some((t) => t.includes(needle)))
    .sort((a, b) => {
      const aExact = a.term === needle ? 1 : 0;
      const bExact = b.term === needle ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aLocale = detected && a.locale === detected ? 1 : 0;
      const bLocale = detected && b.locale === detected ? 1 : 0;
      if (aLocale !== bLocale) return bLocale - aLocale;
      return a.term.localeCompare(b.term);
    });

  const seen = new Set<string>();
  const out: MultilingualSearchSuggestion[] = [];
  for (const item of ranked) {
    const key = `${item.locale}:${item.term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
