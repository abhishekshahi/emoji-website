import { getEmojibaseMetadataByHexcode } from "./emojibase-metadata";
import type { BrowsableEmoji } from "./types";
import { isOpenMojiExtra } from "./types";

export interface SearchableEmoji {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  keywords: string[];
  shortcodes: string[];
  codePoints: string[];
  hexcode: string;
  category: string;
  isExtra: boolean;
}

export interface SearchResult {
  emoji: SearchableEmoji;
  score: number;
}

interface SearchIndex {
  entries: SearchableEmoji[];
  tokenMap: Map<string, Set<number>>;
}

const SCORE = {
  EXACT_EMOJI: 1000,
  EXACT_UNICODE: 900,
  EXACT_HEX: 880,
  EXACT_SHORTCODE: 800,
  EXACT_NAME: 700,
  EXACT_KEYWORD: 500,
  PARTIAL_NAME: 300,
  PARTIAL_KEYWORD: 200,
  TOKEN_MATCH: 100,
  EXTRA_PENALTY: 15,
} as const;

let searchIndex: SearchIndex | null = null;
let searchIndexKey = "";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/g)
    .filter((token) => token.length > 0);
}

function stripShortcodeDelimiters(query: string): string | null {
  const match = query.trim().match(/^:([a-z0-9_+-]+):$/i);
  return match ? match[1].toLowerCase() : null;
}

function mergeSearchTerms(values: string[]): string[] {
  return uniqueStrings(
    values
      .flatMap((value) => tokenize(value))
      .filter((token) => token.length > 0),
  );
}

function toSearchableEmoji(emoji: BrowsableEmoji): SearchableEmoji {
  const isExtra = isOpenMojiExtra(emoji);
  const metadata = isExtra ? undefined : getEmojibaseMetadataByHexcode()[emoji.hexcode];

  const keywords = uniqueStrings([
    ...emoji.keywords,
    ...(metadata?.tags ?? []),
    emoji.name,
    emoji.slug.replace(/-/g, " "),
    ...(metadata?.group ? [metadata.group] : []),
    ...(metadata?.subgroup ? [metadata.subgroup] : []),
  ]);

  const shortcodes = uniqueStrings([
    ...emoji.shortcodes,
    ...(metadata?.shortcodes ?? []),
  ]);

  return {
    id: emoji.id,
    emoji: emoji.emoji,
    name: emoji.name,
    slug: emoji.slug,
    keywords,
    shortcodes,
    codePoints: emoji.codePoints,
    hexcode: emoji.hexcode,
    category: emoji.category,
    isExtra,
  };
}

function buildTokenMap(entries: SearchableEmoji[]): Map<string, Set<number>> {
  const tokenMap = new Map<string, Set<number>>();

  const addToken = (token: string, index: number) => {
    if (!token) {
      return;
    }

    const existing = tokenMap.get(token) ?? new Set<number>();
    existing.add(index);
    tokenMap.set(token, existing);
  };

  entries.forEach((entry, index) => {
    addToken(entry.emoji, index);
    addToken(entry.name.toLowerCase(), index);

    for (const keyword of entry.keywords) {
      for (const token of tokenize(keyword)) {
        addToken(token, index);
      }
    }

    for (const shortcode of entry.shortcodes) {
      addToken(shortcode.toLowerCase(), index);
      for (const token of tokenize(shortcode.replace(/_/g, " "))) {
        addToken(token, index);
      }
    }

    addToken(entry.slug.replace(/-/g, " "), index);
    addToken(entry.hexcode.toLowerCase(), index);
    addToken(entry.hexcode.replace(/-/g, "").toLowerCase(), index);

    for (const codePoint of entry.codePoints) {
      addToken(codePoint.toLowerCase(), index);
      addToken(`u+${codePoint.toLowerCase()}`, index);
    }

    addToken(entry.codePoints.join(" ").toLowerCase(), index);
    addToken(
      entry.codePoints.map((codePoint) => `u+${codePoint}`).join(" ").toLowerCase(),
      index,
    );
  });

  return tokenMap;
}

export function createSearchIndex(emojis: BrowsableEmoji[]): SearchIndex {
  const entries = emojis.map(toSearchableEmoji);
  return {
    entries,
    tokenMap: buildTokenMap(entries),
  };
}

function getSearchIndex(emojis: BrowsableEmoji[]): SearchIndex {
  const metadataCount = Object.keys(getEmojibaseMetadataByHexcode()).length;
  const nextKey = `${emojis.length}:${metadataCount}`;

  if (!searchIndex || searchIndexKey !== nextKey) {
    searchIndex = createSearchIndex(emojis);
    searchIndexKey = nextKey;
  }

  return searchIndex;
}

function resolveCodePointQuery(query: string): number[] | null {
  const trimmed = query.trim();

  const unicodeMatch = trimmed.match(/^u\+([0-9a-f]+(?:\s+u\+[0-9a-f]+)*)$/i);
  if (unicodeMatch) {
    return unicodeMatch[1]
      .split(/\s+/i)
      .map((value) => Number.parseInt(value, 16));
  }

  const hexOnly = trimmed.match(/^([0-9a-f]{4,}(?:[-\s][0-9a-f]{4,})*)$/i);
  if (hexOnly) {
    return hexOnly[1]
      .split(/[-\s]+/i)
      .map((value) => Number.parseInt(value, 16));
  }

  return null;
}

function scoreEntry(
  entry: SearchableEmoji,
  query: string,
  tokens: string[],
  shortcodeQuery: string | null,
): number {
  let score = 0;
  const normalizedName = entry.name.toLowerCase();
  const normalizedQuery = normalizeQuery(query);

  if (entry.emoji === query.trim()) {
    score = Math.max(score, SCORE.EXACT_EMOJI);
  }

  if (normalizedName === normalizedQuery) {
    score = Math.max(score, SCORE.EXACT_NAME);
  } else if (normalizedName.startsWith(normalizedQuery) && normalizedQuery.length >= 2) {
    score = Math.max(score, SCORE.PARTIAL_NAME);
  } else if (normalizedName.includes(normalizedQuery) && normalizedQuery.length >= 2) {
    score = Math.max(score, SCORE.PARTIAL_NAME - 40);
  }

  if (entry.slug === normalizedQuery.replace(/\s+/g, "-")) {
    score = Math.max(score, SCORE.EXACT_NAME - 50);
  }

  if (shortcodeQuery) {
    if (entry.shortcodes.some((shortcode) => shortcode.toLowerCase() === shortcodeQuery)) {
      score = Math.max(score, SCORE.EXACT_SHORTCODE);
    }
  }

  for (const token of tokens) {
    if (entry.keywords.some((keyword) => keyword.toLowerCase() === token)) {
      score = Math.max(score, SCORE.EXACT_KEYWORD);
    } else if (
      entry.keywords.some((keyword) => keyword.toLowerCase().startsWith(token)) &&
      token.length >= 3
    ) {
      score = Math.max(score, SCORE.PARTIAL_KEYWORD);
    }

    if (entry.shortcodes.some((shortcode) => shortcode.toLowerCase() === token)) {
      score = Math.max(score, SCORE.EXACT_SHORTCODE - 20);
    } else if (
      entry.shortcodes.some((shortcode) => shortcode.toLowerCase().includes(token))
    ) {
      score = Math.max(score, SCORE.PARTIAL_KEYWORD);
    }

    if (normalizedName.split(/\s+/).some((word) => word.startsWith(token))) {
      score = Math.max(score, SCORE.TOKEN_MATCH + 20);
    }
  }

  if (entry.isExtra) {
    score = Math.max(0, score - SCORE.EXTRA_PENALTY);
  }

  return score;
}

export function searchEmojis(
  emojis: BrowsableEmoji[],
  query: string,
  limit = 120,
): SearchResult[] {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const index = getSearchIndex(emojis);
  const candidateScores = new Map<number, number>();
  const shortcodeQuery = stripShortcodeDelimiters(trimmedQuery);
  const queryTokens = mergeSearchTerms([
    shortcodeQuery ?? normalizedQuery,
    normalizedQuery,
  ]);
  const codePointQuery = resolveCodePointQuery(trimmedQuery);

  if (codePointQuery) {
    index.entries.forEach((entry, entryIndex) => {
      const entryCodePoints = entry.codePoints.map((codePoint) =>
        Number.parseInt(codePoint, 16),
      );
      const matches =
        entryCodePoints.length === codePointQuery.length &&
        entryCodePoints.every(
          (codePoint, codePointIndex) => codePoint === codePointQuery[codePointIndex],
        );

      if (matches) {
        candidateScores.set(entryIndex, SCORE.EXACT_UNICODE);
      }
    });
  }

  const directHex = trimmedQuery
    .replace(/^u\+/i, "")
    .replace(/[-\s]/g, "")
    .toLowerCase();

  if (/^[0-9a-f]+$/.test(directHex)) {
    index.entries.forEach((entry, entryIndex) => {
      const compactHex = entry.hexcode.replace(/-/g, "").toLowerCase();

      if (compactHex === directHex) {
        candidateScores.set(entryIndex, SCORE.EXACT_HEX);
      } else if (compactHex.includes(directHex) && directHex.length >= 4) {
        candidateScores.set(
          entryIndex,
          Math.max(candidateScores.get(entryIndex) ?? 0, SCORE.EXACT_HEX - 80),
        );
      }
    });
  }

  if (queryTokens.length > 0) {
    const matchedSets = queryTokens.map(
      (token) => index.tokenMap.get(token) ?? new Set<number>(),
    );

    if (matchedSets.every((set) => set.size > 0)) {
      const intersection = [...matchedSets[0]].filter((entryIndex) =>
        matchedSets.every((set) => set.has(entryIndex)),
      );

      for (const entryIndex of intersection) {
        const entry = index.entries[entryIndex];
        const score = scoreEntry(entry, trimmedQuery, queryTokens, shortcodeQuery);
        candidateScores.set(
          entryIndex,
          Math.max(candidateScores.get(entryIndex) ?? 0, score),
        );
      }
    }

    for (const token of queryTokens) {
      const matches = index.tokenMap.get(token);
      if (!matches) {
        continue;
      }

      for (const entryIndex of matches) {
        const entry = index.entries[entryIndex];
        const score = scoreEntry(entry, trimmedQuery, queryTokens, shortcodeQuery);
        candidateScores.set(
          entryIndex,
          Math.max(candidateScores.get(entryIndex) ?? 0, score),
        );
      }
    }
  }

  if (candidateScores.size === 0) {
    index.entries.forEach((entry, entryIndex) => {
      const score = scoreEntry(entry, trimmedQuery, queryTokens, shortcodeQuery);
      if (score > 0) {
        candidateScores.set(entryIndex, score);
      }
    });
  }

  return [...candidateScores.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      if (index.entries[left[0]].isExtra !== index.entries[right[0]].isExtra) {
        return index.entries[left[0]].isExtra ? 1 : -1;
      }

      return index.entries[left[0]].name.localeCompare(index.entries[right[0]].name);
    })
    .slice(0, limit)
    .map(([entryIndex, score]) => ({
      emoji: index.entries[entryIndex],
      score,
    }));
}
