import type { SupportedLanguage } from "./types";
import { PRIMARY_LANGUAGE } from "./types";

export type UiStringKey =
  | "nav.browse"
  | "nav.popular"
  | "nav.explore"
  | "nav.new"
  | "nav.favorites"
  | "search.placeholder"
  | "search.noResults"
  | "search.tryAnother"
  | "copy.copied"
  | "copy.failed"
  | "language.label"
  | "language.englishPage"
  | "language.fallbackNotice"
  | "emoji.meaning"
  | "emoji.unicode"
  | "emoji.copy";

const EN: Record<UiStringKey, string> = {
  "nav.browse": "Browse",
  "nav.popular": "Popular",
  "nav.explore": "Explore",
  "nav.new": "New",
  "nav.favorites": "Favorites",
  "search.placeholder": "Search emojis, meanings, or Unicode…",
  "search.noResults": "No strong matches",
  "search.tryAnother": "Try another search or browse a category.",
  "copy.copied": "Copied!",
  "copy.failed": "Copy failed",
  "language.label": "Language",
  "language.englishPage": "English page",
  "language.fallbackNotice": "Full emoji details are on the English page.",
  "emoji.meaning": "Meaning",
  "emoji.unicode": "Unicode",
  "emoji.copy": "Copy emoji",
};

const UI_STRINGS: Partial<Record<SupportedLanguage, Partial<Record<UiStringKey, string>>>> = {
  es: {
    "nav.browse": "Explorar",
    "nav.popular": "Popular",
    "nav.explore": "Descubrir",
    "nav.new": "Nuevo",
    "nav.favorites": "Favoritos",
    "search.placeholder": "Buscar emojis, significados o Unicode…",
    "search.noResults": "Sin coincidencias claras",
    "search.tryAnother": "Prueba otra búsqueda o explora una categoría.",
    "copy.copied": "¡Copiado!",
    "copy.failed": "Error al copiar",
    "language.label": "Idioma",
    "language.englishPage": "Página en inglés",
    "language.fallbackNotice": "Los detalles completos están en la página en inglés.",
    "emoji.meaning": "Significado",
    "emoji.unicode": "Unicode",
    "emoji.copy": "Copiar emoji",
  },
  fr: {
    "nav.browse": "Parcourir",
    "nav.popular": "Populaire",
    "nav.explore": "Explorer",
    "nav.new": "Nouveau",
    "nav.favorites": "Favoris",
    "search.placeholder": "Rechercher emojis, significations ou Unicode…",
    "search.noResults": "Aucune correspondance forte",
    "search.tryAnother": "Essayez une autre recherche ou une catégorie.",
    "language.label": "Langue",
    "language.englishPage": "Page anglaise",
    "language.fallbackNotice": "Les détails complets sont sur la page anglaise.",
    "emoji.meaning": "Signification",
    "emoji.unicode": "Unicode",
    "emoji.copy": "Copier l'emoji",
  },
  de: {
    "nav.browse": "Durchsuchen",
    "nav.popular": "Beliebt",
    "nav.explore": "Entdecken",
    "nav.new": "Neu",
    "nav.favorites": "Favoriten",
    "search.placeholder": "Emojis, Bedeutungen oder Unicode suchen…",
    "search.noResults": "Keine starken Treffer",
    "search.tryAnother": "Andere Suche oder Kategorie ausprobieren.",
    "language.label": "Sprache",
    "language.englishPage": "Englische Seite",
    "language.fallbackNotice": "Vollständige Details auf der englischen Seite.",
    "emoji.meaning": "Bedeutung",
    "emoji.unicode": "Unicode",
    "emoji.copy": "Emoji kopieren",
  },
  hi: {
    "nav.browse": "ब्राउज़",
    "nav.popular": "लोकप्रिय",
    "nav.explore": "खोजें",
    "nav.new": "नया",
    "nav.favorites": "पसंदीदा",
    "search.placeholder": "इमोजी, अर्थ या Unicode खोजें…",
    "search.noResults": "कोई मजबूत मिलान नहीं",
    "search.tryAnother": "दूसरी खोज या श्रेणी आज़माएँ।",
    "language.label": "भाषा",
    "language.englishPage": "अंग्रेज़ी पृष्ठ",
    "language.fallbackNotice": "पूर्ण विवरण अंग्रेज़ी पृष्ठ पर उपलब्ध हैं।",
    "emoji.meaning": "अर्थ",
    "emoji.unicode": "Unicode",
    "emoji.copy": "इमोजी कॉपी करें",
  },
  ja: {
    "nav.browse": "一覧",
    "nav.popular": "人気",
    "nav.explore": "探索",
    "nav.new": "新着",
    "nav.favorites": "お気に入り",
    "search.placeholder": "絵文字、意味、Unicodeを検索…",
    "search.noResults": "強い一致がありません",
    "search.tryAnother": "別の検索またはカテゴリをお試しください。",
    "language.label": "言語",
    "language.englishPage": "英語ページ",
    "language.fallbackNotice": "詳細は英語ページでご覧ください。",
    "emoji.meaning": "意味",
    "emoji.unicode": "Unicode",
    "emoji.copy": "絵文字をコピー",
  },
  pt: {
    "nav.browse": "Explorar",
    "nav.popular": "Popular",
    "nav.explore": "Descobrir",
    "nav.new": "Novo",
    "nav.favorites": "Favoritos",
    "search.placeholder": "Buscar emojis, significados ou Unicode…",
    "search.noResults": "Nenhuma correspondência forte",
    "search.tryAnother": "Tente outra busca ou categoria.",
    "language.label": "Idioma",
    "language.englishPage": "Página em inglês",
    "language.fallbackNotice": "Detalhes completos na página em inglês.",
    "emoji.meaning": "Significado",
    "emoji.unicode": "Unicode",
    "emoji.copy": "Copiar emoji",
  },
};

export function getUiString(key: UiStringKey, language: string = PRIMARY_LANGUAGE): string {
  if (language === PRIMARY_LANGUAGE) return EN[key];
  return UI_STRINGS[language as SupportedLanguage]?.[key] ?? EN[key];
}

export function getUiStrings(language: string = PRIMARY_LANGUAGE): Record<UiStringKey, string> {
  const keys = Object.keys(EN) as UiStringKey[];
  return Object.fromEntries(keys.map((key) => [key, getUiString(key, language)])) as Record<
    UiStringKey,
    string
  >;
}
