import type { SearchIntentResult } from "./types";
import { isCombinationSearchQuery, searchCombinationsByIntent } from "./combination-search";
import { findCanonicalIdByLocalizedKeyword } from "../localization/keywords";
import { resolveMultilingualUseCaseTerm } from "./multilingual-intent";
import { normalizeSearchQuery, isUnicodeCodePointQuery, expandUnicodeQuery } from "./normalize";

const UNICODE_RE = /^u\+?[0-9a-f]{4,6}(?:[-\s][0-9a-f]{4,6})*$/i;
const HEX_RE = /^[0-9a-f]{4,6}(?:-[0-9a-f]{4,6})+$/i;
const SINGLE_HEX_RE = /^[0-9a-f]{4,6}$/i;

const MEANING_PATTERNS = [
  /^what does (.+) mean\??$/i,
  /^(.+) meaning$/i,
  /^meaning of (.+)$/i,
  /^what is (.+) emoji\??$/i,
];

const USE_CASE_PATTERNS = [
  /^emoji for (.+)$/i,
  /^(.+) emoji$/i,
  /^emojis? (?:for|to) (.+)$/i,
  /^(.+) (?:face|emoji)$/i,
  /^emoji that means (.+)$/i,
  /^(.+) meaning emoji$/i,
];

const USE_CASE_TERM_MAP: Record<string, readonly string[]> = {
  birthday: ["party", "celebration", "cake", "balloon"],
  love: ["heart", "red heart", "love"],
  girlfriend: ["heart", "red heart", "love"],
  boyfriend: ["heart", "red heart", "kiss"],
  friendship: ["handshake", "hug", "friends"],
  congratulations: ["party", "clap", "trophy"],
  sorry: ["pleading", "sad", "folded hands"],
  "thank you": ["folded hands", "heart", "thanks"],
  thanks: ["folded hands", "heart", "thanks"],
  celebration: ["party", "confetti", "trophy"],
  laughing: ["joy", "tears", "laugh", "rofl"],
  sad: ["cry", "sad", "tear"],
  angry: ["angry", "mad", "rage"],
  cute: ["smile", "blush", "heart"],
  gaming: ["game", "controller", "joystick"],
  work: ["office", "briefcase", "computer"],
  professional: ["briefcase", "handshake", "office"],
  instagram: ["camera", "sparkle", "heart"],
  tiktok: ["music", "note", "fire"],
  whatsapp: ["thumbs up", "heart", "folded hands"],
  romance: ["heart", "kiss", "love"],
  romantic: ["heart", "kiss", "love"],
  funny: ["laugh", "joy", "rofl"],
  happy: ["smile", "grin", "joy"],
  travel: ["airplane", "luggage", "map"],
  food: ["pizza", "burger", "coffee"],
  wedding: ["ring", "bouquet", "heart"],
  goodnight: ["moon", "sleep", "star"],
  goodmorning: ["sun", "coffee", "wave"],
  missyou: ["heart", "cry", "hug"],
  goodluck: ["clover", "star", "folded hands"],
  getwell: ["heart", "pill", "flower"],
  graduation: ["cap", "trophy", "party"],
};

const SLUG_ALIASES: Record<string, string> = {
  "red heart": "red-heart",
  heart: "red-heart",
  fire: "fire",
  laugh: "face-with-tears-of-joy",
  laughing: "face-with-tears-of-joy",
  "crying laughing": "face-with-tears-of-joy",
  "sad face": "crying-face",
  "happy face": "grinning-face",
  "heart for girlfriend": "red-heart",
  "heart for boyfriend": "red-heart",
  "unicode fire": "fire",
  "unicode u+1f525": "fire",
};

function normalize(input: string): string {
  return normalizeSearchQuery(input);
}

function extractGroup(pattern: RegExp, query: string): string | null {
  const match = query.match(pattern);
  return match?.[1]?.trim() ?? null;
}

export function classifySearchIntent(query: string, language = "en"): SearchIntentResult {
  const trimmed = query.trim();
  const normalized = normalize(trimmed);

  if (!normalized) {
    return {
      kind: "GENERAL",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: normalized,
      confidence: 0,
    };
  }

  if (isCombinationSearchQuery(trimmed)) {
    const comboSlugs = searchCombinationsByIntent(trimmed);
    return {
      kind: "COMBINATION",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: comboSlugs[0] ?? normalized,
      targetSlug: comboSlugs[0],
      confidence: comboSlugs.length > 0 ? 0.9 : 0.5,
    };
  }

  const localizedCanonical = findCanonicalIdByLocalizedKeyword(normalized, language);
  if (localizedCanonical) {
    const slugMap: Record<string, string> = {
      "unicode:2764": "red heart",
      "unicode:1F525": "fire",
      "unicode:1F602": "face with tears of joy",
      "unicode:1F389": "party popper",
    };
    const searchTerm = slugMap[localizedCanonical] ?? normalized;
    return {
      kind: "EMOJI_LOOKUP",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: searchTerm,
      targetCanonicalId: localizedCanonical,
      confidence: 0.92,
    };
  }

  const multilingualTerm = resolveMultilingualUseCaseTerm(trimmed, language);
  if (multilingualTerm && USE_CASE_TERM_MAP[multilingualTerm]) {
    return {
      kind: "USE_CASE",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: USE_CASE_TERM_MAP[multilingualTerm]![0] ?? multilingualTerm,
      useCaseTerms: USE_CASE_TERM_MAP[multilingualTerm],
      confidence: 0.84,
    };
  }

  if (UNICODE_RE.test(trimmed) || HEX_RE.test(trimmed) || SINGLE_HEX_RE.test(trimmed) || isUnicodeCodePointQuery(trimmed)) {
    const hex = expandUnicodeQuery(trimmed);
    return {
      kind: "UNICODE",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: hex,
      confidence: 1,
    };
  }

  for (const pattern of MEANING_PATTERNS) {
    const term = extractGroup(pattern, trimmed);
    if (term) {
      const slug = SLUG_ALIASES[term] ?? term.replace(/\s+/g, "-");
      return {
        kind: "MEANING",
        originalQuery: query,
        normalizedQuery: normalized,
        expandedQuery: term,
        targetSlug: slug,
        confidence: 0.9,
      };
    }
  }

  if (SLUG_ALIASES[normalized]) {
    return {
      kind: "EMOJI_LOOKUP",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: SLUG_ALIASES[normalized]!,
      targetSlug: SLUG_ALIASES[normalized],
      confidence: 0.95,
    };
  }

  for (const pattern of USE_CASE_PATTERNS) {
    const term = extractGroup(pattern, trimmed);
    if (term && USE_CASE_TERM_MAP[term]) {
      return {
        kind: "USE_CASE",
        originalQuery: query,
        normalizedQuery: normalized,
        expandedQuery: USE_CASE_TERM_MAP[term]![0] ?? term,
        useCaseTerms: USE_CASE_TERM_MAP[term],
        confidence: 0.85,
      };
    }
  }

  if (USE_CASE_TERM_MAP[normalized]) {
    return {
      kind: "USE_CASE",
      originalQuery: query,
      normalizedQuery: normalized,
      expandedQuery: USE_CASE_TERM_MAP[normalized]![0] ?? normalized,
      useCaseTerms: USE_CASE_TERM_MAP[normalized],
      confidence: 0.8,
    };
  }

  return {
    kind: "GENERAL",
    originalQuery: query,
    normalizedQuery: normalized,
    expandedQuery: trimmed,
    confidence: 0.5,
  };
}

/** Resolve the query passed to the existing search engine. */
export function resolveSearchQuery(query: string, language = "en"): {
  intent: SearchIntentResult;
  searchQuery: string;
  combinationSlugs?: readonly string[];
} {
  const intent = classifySearchIntent(query, language);
  let combinationSlugs: readonly string[] | undefined;

  if (intent.kind === "COMBINATION") {
    combinationSlugs = searchCombinationsByIntent(query);
  }
  let searchQuery = intent.expandedQuery;

  if (intent.kind === "MEANING" && intent.targetSlug) {
    searchQuery = intent.targetSlug.replace(/-/g, " ");
  }

  return { intent, searchQuery, combinationSlugs };
}
