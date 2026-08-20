import { normalizeSearchQuery } from "./normalize";

const MULTILINGUAL_USE_CASE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  es: {
    "emoji para cumpleanos": "birthday",
    "emoji de cumpleanos": "birthday",
    "emoji para amor": "love",
    "emoji de amor": "love",
    "emoji triste": "sad",
    "emoji de tristeza": "sad",
    "emoji fuego": "fire",
    "emoji de fuego": "fire",
    "emoji feliz": "happy",
    "emoji de feliz": "happy",
    "emoji para novia": "girlfriend",
    "emoji para novio": "boyfriend",
    "emoji para gracias": "thank you",
    "emoji de gracias": "thank you",
    "emoji perdon": "sorry",
    "emoji de perdon": "sorry",
  },
  fr: {
    "emoji anniversaire": "birthday",
    "emoji pour anniversaire": "birthday",
    "emoji amour": "love",
    "emoji d amour": "love",
    "emoji triste": "sad",
    "emoji feu": "fire",
    "emoji de feu": "fire",
    "emoji heureux": "happy",
    "emoji pour ma copine": "girlfriend",
    "emoji merci": "thank you",
    "emoji pour merci": "thank you",
    "emoji desole": "sorry",
  },
  de: {
    "emoji geburtstag": "birthday",
    "emoji zum geburtstag": "birthday",
    "liebes emoji": "love",
    "emoji liebe": "love",
    "traurig emoji": "sad",
    "emoji traurig": "sad",
    "feuer emoji": "fire",
    "emoji feuer": "fire",
    "gluecklich emoji": "happy",
    "danke emoji": "thank you",
    "emoji danke": "thank you",
    "entschuldigung emoji": "sorry",
  },
  hi: {
    "birthday emoji": "birthday",
    "janmadin emoji": "birthday",
    "love emoji": "love",
    "pyar emoji": "love",
    "sad emoji": "sad",
    "udaas emoji": "sad",
    "fire emoji": "fire",
    "aag emoji": "fire",
    "thank you emoji": "thank you",
    "dhanyavad emoji": "thank you",
    "sorry emoji": "sorry",
    "maaf emoji": "sorry",
  },
  ja: {
    "birthday emoji": "birthday",
    "love emoji": "love",
    "sad emoji": "sad",
    "fire emoji": "fire",
    "tanjobi emoji": "birthday",
    "ai emoji": "love",
    "kanashii emoji": "sad",
    "arigato emoji": "thank you",
  },
  pt: {
    "emoji de aniversario": "birthday",
    "emoji aniversario": "birthday",
    "emoji de amor": "love",
    "emoji amor": "love",
    "emoji triste": "sad",
    "emoji de tristeza": "sad",
    "emoji fogo": "fire",
    "emoji de fogo": "fire",
    "emoji feliz": "happy",
    "emoji obrigado": "thank you",
    "emoji de obrigado": "thank you",
    "emoji desculpa": "sorry",
    "emoji para felicitacoes": "congratulations",
  },
};

/** Native-script phrases checked before ASCII normalization. */
const NATIVE_SCRIPT_USE_CASE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hi: {
    "जन्मदिन इमोजी": "birthday",
    "प्यार इमोजी": "love",
    "दिल इमोजी": "love",
    "आग इमोजी": "fire",
    "धन्यवाद इमोजी": "thank you",
  },
  ja: {
    "誕生日 絵文字": "birthday",
    "ハート 絵文字": "love",
    "愛 絵文字": "love",
    "火 絵文字": "fire",
    "悲しい 絵文字": "sad",
    "ありがとう 絵文字": "thank you",
  },
};

const MEANING_PHRASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  es: {
    "emoji que significa amor": "love",
    "emoji que significa fuego": "fire",
    "emoji que significa tristeza": "sad",
    "significado emoji corazon": "love",
  },
  fr: {
    "emoji qui signifie amour": "love",
    "emoji qui signifie feu": "fire",
  },
  de: {
    "emoji bedeutung liebe": "love",
    "emoji bedeutung feuer": "fire",
  },
  pt: {
    "emoji que significa amor": "love",
    "emoji que significa fogo": "fire",
  },
};

export function resolveMultilingualUseCaseTerm(query: string, language: string): string | null {
  if (language === "en") return null;

  const trimmed = query.trim();
  const nativeMap = NATIVE_SCRIPT_USE_CASE[language];
  if (nativeMap?.[trimmed]) return nativeMap[trimmed]!;

  const meaningMap = MEANING_PHRASES[language];
  if (meaningMap) {
    const lower = trimmed.toLowerCase();
    if (meaningMap[lower]) return meaningMap[lower]!;
  }

  const map = MULTILINGUAL_USE_CASE[language];
  if (!map) return null;
  const normalized = normalizeSearchQuery(query);
  return map[normalized] ?? null;
}
