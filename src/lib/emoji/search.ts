import type { EmojiRecord } from "./types";

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
}

export interface SearchResult {
  emoji: SearchableEmoji;
  score: number;
}

interface SearchIndex {
  entries: SearchableEmoji[];
  tokenMap: Map<string, Set<number>>;
}

let searchIndex: SearchIndex | null = null;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/g)
    .filter((token) => token.length > 0);
}

function toSearchableEmoji(emoji: EmojiRecord): SearchableEmoji {
  return {
    id: emoji.id,
    emoji: emoji.emoji,
    name: emoji.name,
    slug: emoji.slug,
    keywords: emoji.keywords,
    shortcodes: emoji.shortcodes,
    codePoints: emoji.codePoints,
    hexcode: emoji.hexcode,
    category: emoji.category,
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
    addToken(entry.name, index);

    for (const keyword of entry.keywords) {
      for (const token of tokenize(keyword)) {
        addToken(token, index);
      }
    }

    for (const shortcode of entry.shortcodes) {
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

export function createSearchIndex(emojis: EmojiRecord[]): SearchIndex {
  const entries = emojis.map(toSearchableEmoji);
  return {
    entries,
    tokenMap: buildTokenMap(entries),
  };
}

export function getSearchIndex(emojis: EmojiRecord[]): SearchIndex {
  if (!searchIndex) {
    searchIndex = createSearchIndex(emojis);
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

function scoreEntry(entry: SearchableEmoji, query: string, tokens: string[]): number {
  let score = 0;
  const normalizedName = entry.name.toLowerCase();
  const normalizedQuery = normalizeQuery(query);

  if (entry.emoji === query) {
    score += 200;
  }

  if (normalizedName === normalizedQuery) {
    score += 150;
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += 120;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 90;
  }

  if (entry.slug === normalizedQuery.replace(/\s+/g, "-")) {
    score += 100;
  }

  for (const token of tokens) {
    if (entry.keywords.some((keyword) => keyword.toLowerCase() === token)) {
      score += 40;
    }

    if (entry.shortcodes.some((shortcode) => shortcode.toLowerCase().includes(token))) {
      score += 35;
    }

    if (normalizedName.split(/\s+/).some((word) => word.startsWith(token))) {
      score += 25;
    }
  }

  return score;
}

export function searchEmojis(
  emojis: EmojiRecord[],
  query: string,
  limit = 120,
): SearchResult[] {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const index = getSearchIndex(emojis);
  const candidateScores = new Map<number, number>();
  const codePointQuery = resolveCodePointQuery(normalizedQuery);

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
        candidateScores.set(entryIndex, 300);
      }
    });
  }

  const directHex = normalizedQuery.replace(/^u\+/, "").replace(/[-\s]/g, "");
  if (/^[0-9a-f]+$/.test(directHex)) {
    index.entries.forEach((entry, entryIndex) => {
      const compactHex = entry.hexcode.replace(/-/g, "").toLowerCase();
      if (compactHex === directHex || compactHex.includes(directHex)) {
        candidateScores.set(
          entryIndex,
          Math.max(candidateScores.get(entryIndex) ?? 0, 250),
        );
      }
    });
  }

  const queryTokens = tokenize(normalizedQuery);

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
        const score =
          scoreEntry(entry, query, queryTokens) +
          (candidateScores.get(entryIndex) ?? 0);
        candidateScores.set(entryIndex, score);
      }
    }

    for (const token of queryTokens) {
      const matches = index.tokenMap.get(token);
      if (!matches) {
        continue;
      }

      for (const entryIndex of matches) {
        const entry = index.entries[entryIndex];
        const score =
          scoreEntry(entry, query, queryTokens) +
          (candidateScores.get(entryIndex) ?? 0);
        candidateScores.set(entryIndex, Math.max(candidateScores.get(entryIndex) ?? 0, score));
      }
    }
  }

  if (candidateScores.size === 0) {
    index.entries.forEach((entry, entryIndex) => {
      const score = scoreEntry(entry, query, queryTokens);
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

      return index.entries[left[0]].name.localeCompare(index.entries[right[0]].name);
    })
    .slice(0, limit)
    .map(([entryIndex, score]) => ({
      emoji: index.entries[entryIndex],
      score,
    }));
}
