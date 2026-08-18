import { SEARCH_CATEGORY_HINTS, SEARCH_SUGGESTIONS } from "@/lib/emoji/search-suggestions";
import { normalizeSearchQuery } from "./normalize";

export interface ZeroResultRecovery {
  readonly kind: "no_result" | "weak_result" | "misspelling" | "ambiguous";
  readonly suggestions: readonly string[];
  readonly categoryHints: readonly { label: string; query: string }[];
  readonly didYouMean?: string;
}

const MISSPELLING_MAP: Record<string, string> = {
  hart: "heart",
  heartt: "heart",
  luv: "love",
  laff: "laugh",
  birtday: "birthday",
  congradulations: "congratulations",
  congrats: "congratulations",
  girfriend: "girlfriend",
  girlfreind: "girlfriend",
  boyfreind: "boyfriend",
  emojii: "emoji",
  emjoi: "emoji",
};

const NONSENSE_RE = /^(?:z{4,}|x{4,}|\d{6,}|notanemoji\d+|asdf+)$/i;

export function isNonsenseQuery(query: string): boolean {
  const raw = query.trim().toLowerCase();
  if (!raw) return false;
  if (NONSENSE_RE.test(raw)) return true;
  if (raw.length >= 8 && !/[aeiou\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/.test(raw) && /^[b-df-hj-np-tv-z]+$/i.test(raw)) {
    return true;
  }
  return false;
}

export function buildZeroResultRecovery(
  query: string,
  resultCount: number,
): ZeroResultRecovery {
  const raw = query.trim().toLowerCase().replace(/\s+/g, " ").trim();
  const normalized = normalizeSearchQuery(query);
  const didYouMean =
    MISSPELLING_MAP[raw] ?? (raw !== normalized ? normalized : undefined);

  if (resultCount === 0 && isNonsenseQuery(query)) {
    return {
      kind: "no_result",
      suggestions: SEARCH_SUGGESTIONS.slice(0, 6),
      categoryHints: SEARCH_CATEGORY_HINTS,
    };
  }

  if (resultCount === 0 && didYouMean) {
    return {
      kind: "misspelling",
      suggestions: [didYouMean, ...SEARCH_SUGGESTIONS.slice(0, 5)],
      categoryHints: SEARCH_CATEGORY_HINTS,
      didYouMean,
    };
  }

  if (resultCount === 0) {
    return {
      kind: "no_result",
      suggestions: SEARCH_SUGGESTIONS.slice(0, 8),
      categoryHints: SEARCH_CATEGORY_HINTS,
    };
  }

  if (resultCount <= 2) {
    return {
      kind: "weak_result",
      suggestions: SEARCH_SUGGESTIONS.slice(0, 5),
      categoryHints: SEARCH_CATEGORY_HINTS,
    };
  }

  return {
    kind: "ambiguous",
    suggestions: [],
    categoryHints: SEARCH_CATEGORY_HINTS,
  };
}
