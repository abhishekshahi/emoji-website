import type { SupportedLanguage } from "@/lib/content/localization/types";
import { normalizeSearchQuery } from "../processing/phase14/query-normalizer";
import type { LocalizedSearchTerm } from "./types";

/** Controlled locale -> English token mappings for search -- no fabricated record meanings. */
export const LOCALIZED_SEARCH_TERMS: readonly LocalizedSearchTerm[] = [
  { locale: "hi", term: "pyara", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "hi", term: "khush", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "hi", term: "pyaar", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "hi", term: "billi", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ja", term: "kawaii", englishTokens: ["cute", "kawaii"], confidence: "CONTROLLED" },
  { locale: "ja", term: "neko", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "es", term: "lindo", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "es", term: "feliz", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "es", term: "amor", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "es", term: "gato", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "fr", term: "mignon", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "fr", term: "heureux", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "fr", term: "amour", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "fr", term: "chat", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "de", term: "suss", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "de", term: "glucklich", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "de", term: "liebe", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "de", term: "katze", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "pt", term: "fofo", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "pt", term: "feliz", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "pt", term: "amor", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "pt", term: "gato", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "it", term: "carino", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "it", term: "felice", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "it", term: "amore", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "it", term: "gatto", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ko", term: "gwiyeoun", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ko", term: "haengbok", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ko", term: "sarang", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ko", term: "goyangi", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "zh", term: "keai", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "zh", term: "kaixin", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "zh", term: "ai", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "zh", term: "mao", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ar", term: "latif", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ar", term: "saeed", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ar", term: "hub", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ar", term: "qitta", englishTokens: ["cat"], confidence: "CONTROLLED" },
] as const;

const TERM_INDEX = new Map<string, readonly string[]>();
for (const entry of LOCALIZED_SEARCH_TERMS) {
  const key = `${entry.locale}:${normalizeSearchQuery(entry.term).normalized}`;
  TERM_INDEX.set(key, entry.englishTokens);
}

export function resolveLocalizedSearchQuery(query: string, locale?: SupportedLanguage): string {
  const normalized = normalizeSearchQuery(query);
  if (!locale || locale === "en") return normalized.normalized;
  const key = `${locale}:${normalized.normalized}`;
  const tokens = TERM_INDEX.get(key);
  if (!tokens?.length) return normalized.normalized;
  return [...new Set([...normalized.tokens, ...tokens])].join(" ");
}

export function isSupportedKaomojiLocale(value: string | null | undefined): value is SupportedLanguage {
  return value === "en" || value === "hi" || value === "es" || value === "fr" || value === "de"
    || value === "pt" || value === "it" || value === "ja" || value === "ko" || value === "zh" || value === "ar";
}