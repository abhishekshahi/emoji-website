import type { FaqItem } from "./types";

const LOCALIZED_FAQ: Readonly<Partial<Record<string, readonly FaqItem[]>>> = {
  es: [
    {
      id: "es-copy-emoji",
      question: "Como copio un emoji en EmojiQuick?",
      answer:
        "Haz clic o toca el emoji en la pagina o en los resultados de busqueda. EmojiQuick lo copia al portapapeles sin iniciar sesion.",
      category: "emojiquick",
      provenance: {
        source: "editorial",
        author: "EmojiQuick Editorial",
        lastUpdated: new Date().toISOString(),
        qualityStatus: "complete",
      },
    },
    {
      id: "es-multilingual-search",
      question: "Puedo buscar emojis en espanol?",
      answer:
        "Si. Prueba frases como emoji para cumpleanos o palabras clave como corazon y fuego. Las paginas localizadas amplian la cobertura gradualmente.",
      category: "search",
      provenance: {
        source: "editorial",
        author: "EmojiQuick Editorial",
        lastUpdated: new Date().toISOString(),
        qualityStatus: "complete",
      },
    },
  ],
  fr: [
    {
      id: "fr-copy-emoji",
      question: "Comment copier un emoji sur EmojiQuick ?",
      answer:
        "Cliquez ou touchez l emoji sur la page ou dans les resultats de recherche. EmojiQuick le copie dans le presse-papiers sans compte.",
      category: "emojiquick",
      provenance: {
        source: "editorial",
        author: "EmojiQuick Editorial",
        lastUpdated: new Date().toISOString(),
        qualityStatus: "complete",
      },
    },
  ],
};

export function getLocalizedFaqItems(language: string): readonly FaqItem[] {
  return LOCALIZED_FAQ[language] ?? [];
}

export function hasLocalizedFaq(language: string): boolean {
  return (LOCALIZED_FAQ[language]?.length ?? 0) > 0;
}
