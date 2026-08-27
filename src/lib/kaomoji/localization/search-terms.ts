import type { SupportedLanguage } from "@/lib/content/localization/types";
import { normalizeSearchQuery } from "../processing/phase14/query-normalizer";
import type { LocalizedSearchTerm } from "./types";

/** Controlled locale -> English token mappings for search — no fabricated record meanings. */
export const LOCALIZED_SEARCH_TERMS: readonly LocalizedSearchTerm[] = [
  // Hindi — Devanagari + romanized
  { locale: "hi", term: "pyara", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "hi", term: "pyaara", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "hi", term: "प्यारा", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "hi", term: "khush", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "hi", term: "खुश", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "hi", term: "pyaar", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "hi", term: "prem", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "hi", term: "प्यार", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "hi", term: "प्रेम", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "hi", term: "gale lagana", englishTokens: ["hug", "comfort"], confidence: "CONTROLLED" },
  { locale: "hi", term: "gale lagaana", englishTokens: ["hug", "comfort"], confidence: "CONTROLLED" },
  { locale: "hi", term: "गले लगाना", englishTokens: ["hug", "comfort"], confidence: "CONTROLLED" },
  { locale: "hi", term: "udaas", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "hi", term: "udās", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "hi", term: "उदास", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "hi", term: "billi", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "hi", term: "बिल्ली", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Japanese
  { locale: "ja", term: "kawaii", englishTokens: ["cute", "kawaii"], confidence: "CONTROLLED" },
  { locale: "ja", term: "かわいい", englishTokens: ["cute", "kawaii"], confidence: "CONTROLLED" },
  { locale: "ja", term: "可愛い", englishTokens: ["cute", "kawaii"], confidence: "CONTROLLED" },
  { locale: "ja", term: "嬉しい", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ja", term: "うれしい", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ja", term: "愛", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ja", term: "ハグ", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "ja", term: "だきしめ", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "ja", term: "悲しい", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "ja", term: "かなしい", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "ja", term: "neko", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ja", term: "猫", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Spanish
  { locale: "es", term: "lindo", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "es", term: "linda", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "es", term: "feliz", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "es", term: "amor", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "es", term: "abrazo", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "es", term: "triste", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "es", term: "gato", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // French
  { locale: "fr", term: "mignon", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "fr", term: "heureux", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "fr", term: "amour", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "fr", term: "câlin", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "fr", term: "calin", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "fr", term: "triste", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "fr", term: "chat", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // German
  { locale: "de", term: "suss", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "de", term: "süß", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "de", term: "glucklich", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "de", term: "glücklich", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "de", term: "liebe", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "de", term: "umarmung", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "de", term: "traurig", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "de", term: "katze", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Portuguese
  { locale: "pt", term: "fofo", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "pt", term: "fofa", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "pt", term: "feliz", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "pt", term: "amor", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "pt", term: "abraco", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "pt", term: "abraço", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "pt", term: "triste", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "pt", term: "gato", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Italian
  { locale: "it", term: "carino", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "it", term: "carina", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "it", term: "felice", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "it", term: "amore", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "it", term: "abbraccio", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "it", term: "triste", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "it", term: "gatto", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Korean — Hangul + romanized
  { locale: "ko", term: "gwiyeoun", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ko", term: "귀여운", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ko", term: "haengbok", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ko", term: "행복", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ko", term: "sarang", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ko", term: "사랑", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ko", term: "poong", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "ko", term: "포옹", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "ko", term: "seulpeum", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "ko", term: "슬픔", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "ko", term: "goyangi", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ko", term: "고양이", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Chinese — simplified + pinyin
  { locale: "zh", term: "keai", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "zh", term: "可爱", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "zh", term: "kaixin", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "zh", term: "开心", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "zh", term: "ai", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "zh", term: "爱", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "zh", term: "愛", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "zh", term: "yongbao", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "zh", term: "拥抱", englishTokens: ["hug"], confidence: "CONTROLLED" },
  { locale: "zh", term: "beishang", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "zh", term: "悲伤", englishTokens: ["sad"], confidence: "CONTROLLED" },
  { locale: "zh", term: "mao", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "zh", term: "猫", englishTokens: ["cat"], confidence: "CONTROLLED" },
  // Arabic
  { locale: "ar", term: "latif", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ar", term: "لطيف", englishTokens: ["cute"], confidence: "CONTROLLED" },
  { locale: "ar", term: "saeed", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ar", term: "سعيد", englishTokens: ["happy"], confidence: "CONTROLLED" },
  { locale: "ar", term: "hub", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ar", term: "حب", englishTokens: ["love"], confidence: "CONTROLLED" },
  { locale: "ar", term: "qitta", englishTokens: ["cat"], confidence: "CONTROLLED" },
  { locale: "ar", term: "قطة", englishTokens: ["cat"], confidence: "CONTROLLED" },
] as const;

const TERM_INDEX = new Map<string, readonly string[]>();
for (const entry of LOCALIZED_SEARCH_TERMS) {
  const key = `${entry.locale}:${normalizeTermKey(entry.term)}`;
  TERM_INDEX.set(key, entry.englishTokens);
}

function normalizeTermKey(term: string): string {
  return term.normalize("NFC").trim().toLowerCase();
}

export function lookupLocalizedEnglishTokens(term: string, locale: SupportedLanguage): readonly string[] {
  const key = `${locale}:${normalizeTermKey(term)}`;
  return TERM_INDEX.get(key) ?? [];
}

export function resolveLocalizedSearchQuery(query: string, locale?: SupportedLanguage): string {
  const normalized = normalizeSearchQuery(query);
  if (!locale || locale === "en") return normalized.normalized;
  const key = `${locale}:${normalizeTermKey(normalized.normalized)}`;
  const tokens = TERM_INDEX.get(key);
  if (!tokens?.length) return normalized.normalized;
  return [...new Set([...normalized.tokens, ...tokens])].join(" ");
}

export function isSupportedKaomojiLocale(value: string | null | undefined): value is SupportedLanguage {
  return (
    value === "en" ||
    value === "hi" ||
    value === "es" ||
    value === "fr" ||
    value === "de" ||
    value === "pt" ||
    value === "it" ||
    value === "ja" ||
    value === "ko" ||
    value === "zh" ||
    value === "ar"
  );
}

export function parseKaomojiSearchLocale(raw: string | null | undefined): KaomojiSearchLocaleHint {
  if (!raw || raw === "auto") return "auto";
  return isSupportedKaomojiLocale(raw) ? raw : "auto";
}

export type KaomojiSearchLocaleHint = SupportedLanguage | "auto";

export const KAOMOJI_SEARCH_LOCALE_OPTIONS: readonly { value: KaomojiSearchLocaleHint; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
];
