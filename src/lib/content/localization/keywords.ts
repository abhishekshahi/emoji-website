import { registerLocalizedContent } from "./registry";
import { PUBLISHED_LOCALIZED_PAGES } from "./published-pages";
import type { SupportedLanguage } from "./types";

const LOCALIZED_KEYWORDS: Readonly<
  Record<string, Partial<Record<SupportedLanguage, readonly string[]>>>
> = {
  "unicode:2764": {
    es: ["corazon", "amor"],
    fr: ["coeur", "amour"],
    de: ["herz", "liebe"],
    hi: ["dil"],
    ja: ["heart"],
    ko: ["heart"],
    pt: ["coracao", "amor"],
    zh: ["xin"],
    ar: ["qalb"],
  },
  "unicode:1F525": {
    es: ["fuego"],
    fr: ["feu"],
    de: ["feuer"],
    ja: ["fire"],
    ko: ["fire"],
    pt: ["fogo"],
    zh: ["huo"],
  },
  "unicode:1F602": {
    es: ["risa"],
    fr: ["rire"],
    de: ["lachen"],
    hi: ["hasi"],
    ja: ["warai"],
    pt: ["riso"],
  },
  "unicode:1F389": {
    es: ["fiesta", "cumpleanos"],
    fr: ["fete", "anniversaire"],
    de: ["party", "geburtstag"],
    hi: ["janmadin", "party"],
    ja: ["birthday"],
    pt: ["festa", "aniversario"],
  },
  "unicode:1F622": {
    es: ["triste"],
    fr: ["triste"],
    de: ["traurig"],
    hi: ["udaas"],
    ja: ["sad"],
    pt: ["triste"],
  },
  "unicode:1F600": {
    es: ["feliz", "sonrisa"],
    fr: ["heureux", "sourire"],
    de: ["gluecklich", "laecheln"],
    hi: ["khush", "muskurahat"],
    ja: ["happy", "egao"],
    pt: ["feliz", "sorriso"],
  },
  "unicode:1F64F": {
    es: ["gracias", "rezo"],
    fr: ["merci"],
    de: ["danke"],
    hi: ["dhanyavaad", "namaste"],
    ja: ["arigato"],
    pt: ["obrigado"],
  },
  "unicode:1F480": {
    es: ["calavera"],
    fr: ["crane"],
    de: ["totenkopf"],
    pt: ["caveira"],
  },
  "unicode:2728": {
    es: ["brillo", "destellos"],
    fr: ["etincelles"],
    de: ["funkeln"],
    ja: ["kirakira"],
    pt: ["brilho"],
  },
};

function bootstrap(): void {
  const now = new Date().toISOString();
  for (const [canonicalId, byLang] of Object.entries(LOCALIZED_KEYWORDS)) {
    for (const [language, keywords] of Object.entries(byLang)) {
      registerLocalizedContent({
        canonicalId,
        language: language as SupportedLanguage,
        keywords,
        provenance: {
          source: "translated",
          author: "EmojiQuick Localization",
          lastUpdated: now,
          qualityStatus: "partial",
        },
      });
    }
  }
  for (const page of PUBLISHED_LOCALIZED_PAGES) {
    registerLocalizedContent({
      canonicalId: page.canonicalId,
      language: page.language,
      localizedName: page.localizedTitle,
      shortDescription: page.localizedDescription,
      provenance: {
        source: "translated",
        author: "EmojiQuick Localization",
        lastUpdated: now,
        qualityStatus: "partial",
      },
    });
  }
}

bootstrap();

export function findCanonicalIdByLocalizedKeyword(
  query: string,
  language: string,
): string | null {
  const normalized = query.trim().toLowerCase();
  for (const [canonicalId, byLang] of Object.entries(LOCALIZED_KEYWORDS)) {
    const keywords = byLang[language as SupportedLanguage];
    if (keywords?.some((k) => k.toLowerCase() === normalized)) {
      return canonicalId;
    }
  }
  return null;
}

export { LOCALIZED_KEYWORDS };
