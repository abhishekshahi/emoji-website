import { getMasterReader } from "./master-reader";
import type { MasterSearchMatchKind, MasterSearchResponse, MasterSearchResult } from "./types";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function scoreForMatch(kind: MasterSearchMatchKind, searchEntry: { proposedRankingModel: Record<string, number> }): number {
  const model = searchEntry.proposedRankingModel;
  switch (kind) {
    case "emoji":
      return model.exactEmoji;
    case "unicode":
      return model.exactUnicode;
    case "hexcode":
      return model.exactHexcode;
    case "canonical-name":
      return model.exactCanonicalName;
    case "alias":
      return model.exactAlias;
    case "keyword":
      return model.exactKeyword;
    case "shortcode":
      return model.exactShortcode;
    case "semantic":
      return model.semanticMatch;
    default:
      return 0;
  }
}

function pushResult(
  results: MasterSearchResult[],
  seen: Set<string>,
  candidate: MasterSearchResult,
): void {
  const key = `${candidate.canonicalId}:${candidate.matchKind}:${candidate.matchedTerm}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  results.push(candidate);
}

export function searchMaster(query: string, rootDir?: string): MasterSearchResponse {
  const reader = getMasterReader(rootDir);
  const normalized = normalizeQuery(query);
  const results: MasterSearchResult[] = [];
  const seen = new Set<string>();

  if (!normalized) {
    return Object.freeze({ query, results: Object.freeze([]), ambiguous: false });
  }

  for (const entry of reader.searchIndex.values()) {
    const base = {
      canonicalId: entry.canonicalId,
      emoji: entry.emoji,
      canonicalName: entry.canonicalName,
      ambiguous: false,
    };

    if (entry.emoji === query.trim()) {
      pushResult(results, seen, {
        ...base,
        matchKind: "emoji",
        matchedTerm: entry.emoji ?? query,
        score: scoreForMatch("emoji", entry),
      });
    }

    if (entry.unicodeSequence?.toLowerCase() === normalized || entry.hexcode?.toLowerCase() === normalized) {
      pushResult(results, seen, {
        ...base,
        matchKind: entry.hexcode?.toLowerCase() === normalized ? "hexcode" : "unicode",
        matchedTerm: entry.hexcode ?? entry.unicodeSequence ?? query,
        score: scoreForMatch(entry.hexcode?.toLowerCase() === normalized ? "hexcode" : "unicode", entry),
      });
    }

    if (entry.canonicalName.toLowerCase() === normalized) {
      pushResult(results, seen, {
        ...base,
        matchKind: "canonical-name",
        matchedTerm: entry.canonicalName,
        score: scoreForMatch("canonical-name", entry),
      });
    }

    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        pushResult(results, seen, {
          ...base,
          matchKind: "alias",
          matchedTerm: alias,
          score: scoreForMatch("alias", entry),
        });
      }
    }

    for (const keyword of entry.keywords) {
      if (keyword.toLowerCase() === normalized) {
        pushResult(results, seen, {
          ...base,
          matchKind: "keyword",
          matchedTerm: keyword,
          score: scoreForMatch("keyword", entry),
        });
      }
    }

    for (const shortcode of entry.shortcodes) {
      const normalizedShortcode = shortcode.toLowerCase().replace(/^:+|:+$/g, "");
      if (normalizedShortcode === normalized || shortcode.toLowerCase() === normalized) {
        pushResult(results, seen, {
          ...base,
          matchKind: "shortcode",
          matchedTerm: shortcode,
          score: scoreForMatch("shortcode", entry),
        });
      }
    }
  }

  const semanticTerm = reader.semanticSearchTerms.get(normalized);
  let ambiguous = false;

  if (semanticTerm) {
    if (semanticTerm.publicSearch && !semanticTerm.ambiguous) {
      for (const canonicalId of semanticTerm.canonicalIds) {
        const entry = reader.searchIndex.get(canonicalId);
        if (!entry) {
          continue;
        }
        pushResult(results, seen, {
          canonicalId,
          emoji: entry.emoji,
          canonicalName: entry.canonicalName,
          matchKind: "semantic",
          matchedTerm: semanticTerm.term,
          score: scoreForMatch("semantic", entry),
          ambiguous: false,
        });
      }
    } else if (semanticTerm.ambiguous || !semanticTerm.publicSearch) {
      ambiguous = true;
    }
  }

  results.sort((left, right) => right.score - left.score || left.canonicalName.localeCompare(right.canonicalName));

  return Object.freeze({
    query,
    results: Object.freeze(results),
    ambiguous,
  });
}

export function isAmbiguousMasterSearchTerm(term: string, rootDir?: string): boolean {
  const reader = getMasterReader(rootDir);
  const semanticTerm = reader.semanticSearchTerms.get(normalizeQuery(term));
  if (!semanticTerm) {
    return false;
  }
  return semanticTerm.ambiguous || !semanticTerm.publicSearch;
}
