import { LOCALE_REGISTRY } from "@/lib/content/localization/locales";
import { PRIMARY_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/content/localization/types";
import type { KaomojiLocaleBundle, KaomojiUiStrings, Phase15LocaleRegistry } from "./types";
import { LOCALIZED_SEARCH_TERMS } from "./search-terms";

const EN_UI: KaomojiUiStrings = {
  searchPlaceholder: "Search cute, love, cat, happy kaomoji…",
  searchButton: "Search",
  emptyResults: "No kaomoji matched your search. Try cute, love, or cat.",
  loading: "Searching…",
  copy: "Copy",
  copied: "Copied!",
  favorite: "Favorite",
  favorited: "Favorited",
  share: "Share",
  relatedHeading: "Related Kaomoji",
  keywordsHeading: "Keywords",
};

const UI_BY_LOCALE: Readonly<Partial<Record<SupportedLanguage, KaomojiUiStrings>>> = {
  hi: {
    ...EN_UI,
    searchPlaceholder: "प्यारा, प्यार, बिल्ली, खुश kaomoji खोजें…",
    searchButton: "खोजें",
    emptyResults: "कोई kaomoji नहीं मिला। cute, love, या cat आज़माएँ।",
    loading: "खोज रहे हैं…",
  },
  ja: {
    ...EN_UI,
    searchPlaceholder: "かわいい、愛、猫、嬉しい kaomoji を検索…",
    searchButton: "検索",
    emptyResults: "一致する kaomoji がありません。cute、love、cat を試してください。",
    loading: "検索中…",
  },
  es: {
    ...EN_UI,
    searchPlaceholder: "Buscar kaomoji lindo, amor, gato, feliz…",
    searchButton: "Buscar",
    emptyResults: "No hay kaomoji. Prueba cute, love o cat.",
    loading: "Buscando…",
  },
  fr: {
    ...EN_UI,
    searchPlaceholder: "Rechercher kaomoji mignon, amour, chat, heureux…",
    searchButton: "Rechercher",
    emptyResults: "Aucun kaomoji. Essayez cute, love ou cat.",
    loading: "Recherche…",
  },
  de: {
    ...EN_UI,
    searchPlaceholder: "Süße, Liebe, Katze, glückliche Kaomoji suchen…",
    searchButton: "Suchen",
    emptyResults: "Keine Kaomoji gefunden. Versuchen Sie cute, love oder cat.",
    loading: "Suche…",
  },
};

const CATEGORY_EN: Readonly<Record<string, string>> = {
  cute: "Cute",
  happy: "Happy",
  love: "Love",
  sad: "Sad",
  angry: "Angry",
  cat: "Cat",
  bear: "Bear",
  japanese: "Japanese",
  ascii: "ASCII",
  kawaii: "Kawaii",
};

function categoryLabelsFor(locale: SupportedLanguage): Readonly<Record<string, string>> {
  if (locale === "en") return CATEGORY_EN;
  const partial: Record<string, string> = { ...CATEGORY_EN };
  if (locale === "hi") {
    partial.cute = "प्यारा";
    partial.happy = "खुश";
    partial.love = "प्यार";
    partial.cat = "बिल्ली";
  }
  if (locale === "ja") {
    partial.cute = "かわいい";
    partial.happy = "嬉しい";
    partial.love = "愛";
    partial.cat = "猫";
  }
  if (locale === "es") {
    partial.cute = "Lindo";
    partial.happy = "Feliz";
    partial.love = "Amor";
    partial.cat = "Gato";
  }
  return partial;
}

export function buildKaomojiLocaleBundle(locale: SupportedLanguage): KaomojiLocaleBundle {
  const def = LOCALE_REGISTRY[locale];
  const status = def.publicationStatus === "published" ? "PUBLISHED" : "REVIEW_REQUIRED";
  return {
    locale,
    status,
    ui: UI_BY_LOCALE[locale] ?? EN_UI,
    categoryLabels: categoryLabelsFor(locale),
  };
}

export function buildPhase15LocaleRegistry(): Phase15LocaleRegistry {
  return {
    version: "15.0.0",
    primaryLocale: PRIMARY_LANGUAGE,
    supportedLocales: SUPPORTED_LANGUAGES,
    bundles: SUPPORTED_LANGUAGES.map(buildKaomojiLocaleBundle),
    localizedSearchTerms: LOCALIZED_SEARCH_TERMS,
  };
}

export function getKaomojiUiStrings(locale: SupportedLanguage = "en"): KaomojiUiStrings {
  return UI_BY_LOCALE[locale] ?? EN_UI;
}
