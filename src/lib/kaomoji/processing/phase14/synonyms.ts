export const SEARCH_SYNONYM_VERSION = "1.0.0";

/** Controlled intent synonyms — maps to existing taxonomy/keywords only. */
export const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  anime: ["japanese", "kawaii", "cute"],
  manga: ["japanese", "kawaii"],
  otaku: ["japanese", "kawaii"],
  discord: ["ascii", "text face", "greeting"],
  instagram: ["aesthetic", "cute", "kawaii"],
  whatsapp: ["ascii", "greeting", "happy"],
  telegram: ["ascii", "greeting"],
  twitter: ["ascii", "aesthetic"],
  social: ["greeting", "happy"],
  chat: ["greeting", "ascii"],
  messaging: ["greeting", "ascii"],
  hapy: ["happy"],
  happpy: ["happy"],
  angrey: ["angry"],
  kaomji: ["kaomoji"],
  cut: ["cute"],
  kawai: ["kawaii"],
  joy: ["happy"],
  cheerful: ["happy"],
  smile: ["happy"],
  tearful: ["crying"],
  tears: ["crying"],
  mad: ["angry"],
  rage: ["angry"],
  adorable: ["cute"],
  heart: ["love"],
  affection: ["love"],
  bunny: ["rabbit"],
  rabbit: ["bunny"],
  sleeping: ["sleepy"],
  sleep: ["sleepy"],
  shrug: ["confused"],
  dance: ["dancing"],
  japanese: ["japanese"],
  minimal: ["ascii"],
  minimalist: ["ascii"],
  textface: ["text face"],
  emoticon: ["ascii"],
};

export function expandSynonyms(token: string): readonly string[] {
  const key = token.toLowerCase();
  const direct = SEARCH_SYNONYMS[key];
  if (direct) return [key, ...direct];
  return [key];
}

export function expandQueryTokens(tokens: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    for (const s of expandSynonyms(t)) out.add(s);
  }
  return [...out];
}