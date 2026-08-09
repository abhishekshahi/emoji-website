export const MASTER_SEARCH_SCORE = {
  EXACT_EMOJI: 1000,
  EXACT_UNICODE: 900,
  EXACT_HEXCODE: 880,
  EXACT_SHORTCODE: 800,
  EXACT_CANONICAL_NAME: 700,
  EXACT_SAFE_ALIAS: 600,
  EXACT_SAFE_KEYWORD: 500,
  SAFE_SEMANTIC_SYNONYM: 400,
  PREFIX_NAME: 300,
  PREFIX_ALIAS: 250,
  PREFIX_KEYWORD: 200,
  PARTIAL_SAFE: 100,
  EXTRA_PENALTY: 15,
} as const;

export function compareMasterSearchScores(
  left: { score: number; isExtra: boolean; canonicalName: string; canonicalId: string; matchedField: string },
  right: { score: number; isExtra: boolean; canonicalName: string; canonicalId: string; matchedField: string },
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (left.matchedField === "emoji" && right.matchedField !== "emoji") {
    return -1;
  }
  if (right.matchedField === "emoji" && left.matchedField !== "emoji") {
    return 1;
  }
  if (left.matchedField !== "emoji" || right.matchedField !== "emoji") {
    const leftComplexity = left.canonicalId.split("-").length;
    const rightComplexity = right.canonicalId.split("-").length;
    if (leftComplexity !== rightComplexity) {
      return leftComplexity - rightComplexity;
    }
  }
  if (left.isExtra !== right.isExtra) {
    return left.isExtra ? 1 : -1;
  }
  return left.canonicalName.localeCompare(right.canonicalName);
}

export function normalizeEmojiForMatch(emoji: string): string {
  return emoji.replace(/\uFE0F/g, "");
}

export function queryContainsVariationSelector(query: string): boolean {
  return query.includes("\uFE0F");
}

export function canonicalHasVariationSelector(canonicalId: string): boolean {
  return canonicalId.includes("-FE0F");
}

export function emojiCharactersMatch(left: string | null, right: string): boolean {
  if (!left) {
    return false;
  }
  if (left === right) {
    return true;
  }
  return normalizeEmojiForMatch(left) === normalizeEmojiForMatch(right);
}

export function emojiVariationSelectorAligned(canonicalId: string, query: string): boolean {
  return queryContainsVariationSelector(query) === canonicalHasVariationSelector(canonicalId);
}

export function isLikelyEmojiCharacterQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }
  return !/^[a-z0-9:_+#.\s-]+$/i.test(trimmed);
}
