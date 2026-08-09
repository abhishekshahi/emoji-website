import { getMasterReader } from "../master-reader";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { getMasterSearchStaticIndex, resolveCodePointQuery, resolveShortcodeQuery } from "./index-data";
import {
  compareMasterSearchScores,
  emojiCharactersMatch,
  emojiVariationSelectorAligned,
  isLikelyEmojiCharacterQuery,
  MASTER_SEARCH_SCORE,
} from "./ranking";
import type {
  MasterSearchIntegrationResponse,
  MasterSearchIntegrationResult,
  MasterSearchProvenance,
} from "./types";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function buildProvenance(
  term: string,
  source: string,
  canonicalId: string,
  sourceRecordRef?: string,
): MasterSearchProvenance {
  return Object.freeze({ term, source, canonicalId, sourceRecordRef });
}

function isExtraCanonical(canonicalId: string, rootDir?: string): boolean {
  const index = getMasterSearchStaticIndex(rootDir);
  const production = index.productionCanonicalById.get(canonicalId);
  return production?.productionType === "extra";
}

function pushCandidate(
  candidates: Map<string, MasterSearchIntegrationResult>,
  candidate: MasterSearchIntegrationResult,
): void {
  const existing = candidates.get(candidate.canonicalId);
  if (!existing || candidate.score > existing.score) {
    candidates.set(candidate.canonicalId, candidate);
  }
}

export function searchMasterIntegrated(query: string, rootDir?: string, limit = 120): MasterSearchIntegrationResponse {
  const normalized = normalizeQuery(query);
  const trimmed = query.trim();
  if (!normalized) {
    return Object.freeze({ query, results: Object.freeze([]), ambiguous: false });
  }

  const reader = getMasterReader(rootDir);
  const staticIndex = getMasterSearchStaticIndex(rootDir);
  const candidates = new Map<string, MasterSearchIntegrationResult>();
  const shortcodeQuery = resolveShortcodeQuery(query);
  const codePointQuery = resolveCodePointQuery(query);
  let ambiguous = isAmbiguousMasterSearchTerm(normalized, rootDir);

  for (const entry of reader.searchIndex.values()) {
    const production = staticIndex.productionCanonicalById.get(entry.canonicalId);
    const isExtra = isExtraCanonical(entry.canonicalId, rootDir);
    const semanticEntry = reader.semanticIndex.get(entry.canonicalId);
    const safeAliasSet = new Set(
      (semanticEntry?.aliasAudits ?? []).filter((audit) => audit.publicAlias).map((audit) => audit.value.toLowerCase()),
    );

    const base = {
      canonicalId: entry.canonicalId,
      character: entry.emoji,
      canonicalName: entry.canonicalName,
      isExtra,
      productionId: production?.productionId ?? null,
      productionHexcode: production?.hexcode ?? entry.hexcode,
    };

    if (entry.emoji === trimmed) {
      const variationAligned = emojiVariationSelectorAligned(entry.canonicalId, trimmed);
      pushCandidate(candidates, {
        ...base,
        matchedField: "emoji",
        matchedTerm: entry.emoji ?? trimmed,
        score: variationAligned ? MASTER_SEARCH_SCORE.EXACT_EMOJI : MASTER_SEARCH_SCORE.EXACT_EMOJI - 1,
        source: "canonical-search-index",
        confidence: variationAligned ? 1 : 0.99,
        provenance: buildProvenance(entry.emoji ?? trimmed, "canonical-search-index", entry.canonicalId),
      });
    } else if (emojiCharactersMatch(entry.emoji, trimmed)) {
      const variationAligned = emojiVariationSelectorAligned(entry.canonicalId, trimmed);
      pushCandidate(candidates, {
        ...base,
        matchedField: "emoji",
        matchedTerm: entry.emoji ?? trimmed,
        score: variationAligned ? MASTER_SEARCH_SCORE.EXACT_EMOJI - 1 : MASTER_SEARCH_SCORE.EXACT_EMOJI - 2,
        source: "canonical-search-index",
        confidence: variationAligned ? 0.99 : 0.97,
        provenance: buildProvenance(entry.emoji ?? trimmed, "canonical-search-index", entry.canonicalId),
      });
    }

    const compactHex = entry.hexcode?.replace(/-/g, "").toLowerCase();
    if (codePointQuery && compactHex === codePointQuery.toLowerCase()) {
      pushCandidate(candidates, {
        ...base,
        matchedField: "unicode",
        matchedTerm: codePointQuery,
        score: MASTER_SEARCH_SCORE.EXACT_UNICODE,
        source: "canonical-search-index",
        confidence: 1,
        provenance: buildProvenance(codePointQuery, "unicode-emoji-data", entry.canonicalId),
      });
    }

    if (compactHex === normalized.replace(/-/g, "") || entry.hexcode?.toLowerCase() === normalized) {
      pushCandidate(candidates, {
        ...base,
        matchedField: "hexcode",
        matchedTerm: entry.hexcode ?? normalized,
        score: MASTER_SEARCH_SCORE.EXACT_HEXCODE,
        source: "canonical-search-index",
        confidence: 1,
        provenance: buildProvenance(entry.hexcode ?? normalized, "canonical-search-index", entry.canonicalId),
      });
    }

    if (entry.canonicalName.toLowerCase() === normalized) {
      pushCandidate(candidates, {
        ...base,
        matchedField: "canonical-name",
        matchedTerm: entry.canonicalName,
        score: MASTER_SEARCH_SCORE.EXACT_CANONICAL_NAME,
        source: entry.provenance.canonicalName.source,
        confidence: 1,
        provenance: buildProvenance(entry.canonicalName, entry.provenance.canonicalName.source, entry.canonicalId),
      });
    } else if (!isLikelyEmojiCharacterQuery(trimmed) && entry.canonicalName.toLowerCase().startsWith(normalized) && normalized.length >= 2) {
      pushCandidate(candidates, {
        ...base,
        matchedField: "canonical-name",
        matchedTerm: entry.canonicalName,
        score: MASTER_SEARCH_SCORE.PREFIX_NAME,
        source: entry.provenance.canonicalName.source,
        confidence: 0.8,
        provenance: buildProvenance(entry.canonicalName, entry.provenance.canonicalName.source, entry.canonicalId),
      });
    }

    for (const alias of entry.aliases) {
      const aliasLower = alias.toLowerCase();
      if (!safeAliasSet.has(aliasLower)) {
        continue;
      }
      if (aliasLower === normalized) {
        pushCandidate(candidates, {
          ...base,
          matchedField: "alias",
          matchedTerm: alias,
          score: MASTER_SEARCH_SCORE.EXACT_SAFE_ALIAS,
          source: "alias-audit",
          confidence: 0.95,
          provenance: buildProvenance(alias, "alias-audit", entry.canonicalId),
        });
      } else if (aliasLower.startsWith(normalized) && normalized.length >= 2) {
        pushCandidate(candidates, {
          ...base,
          matchedField: "alias",
          matchedTerm: alias,
          score: MASTER_SEARCH_SCORE.PREFIX_ALIAS,
          source: "alias-audit",
          confidence: 0.75,
          provenance: buildProvenance(alias, "alias-audit", entry.canonicalId),
        });
      }
    }

    for (const keyword of entry.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (keywordLower === normalized) {
        pushCandidate(candidates, {
          ...base,
          matchedField: "keyword",
          matchedTerm: keyword,
          score: MASTER_SEARCH_SCORE.EXACT_SAFE_KEYWORD,
          source: "canonical-keywords",
          confidence: 0.9,
          provenance: buildProvenance(keyword, "canonical-keywords", entry.canonicalId),
        });
      } else if (keywordLower.startsWith(normalized) && normalized.length >= 3) {
        pushCandidate(candidates, {
          ...base,
          matchedField: "keyword",
          matchedTerm: keyword,
          score: MASTER_SEARCH_SCORE.PREFIX_KEYWORD,
          source: "canonical-keywords",
          confidence: 0.7,
          provenance: buildProvenance(keyword, "canonical-keywords", entry.canonicalId),
        });
      }
    }

    const queryWords = normalized.split(/\s+/).filter((word) => word.length > 0);
    if (queryWords.length > 1 && !isLikelyEmojiCharacterQuery(trimmed)) {
      const keywordSet = new Set(entry.keywords.map((keyword) => keyword.toLowerCase()));
      const aliasSet = new Set(
        entry.aliases
          .map((alias) => alias.toLowerCase())
          .filter((alias) => safeAliasSet.has(alias)),
      );
      const allWordsMatch = queryWords.every(
        (word) => keywordSet.has(word) || aliasSet.has(word),
      );
      if (allWordsMatch) {
        pushCandidate(candidates, {
          ...base,
          matchedField: "keyword",
          matchedTerm: normalized,
          score: MASTER_SEARCH_SCORE.EXACT_SAFE_KEYWORD,
          source: "canonical-keywords",
          confidence: 0.92,
          provenance: buildProvenance(normalized, "canonical-keywords", entry.canonicalId),
        });
      }
    }
  }

  const shortcodeMatches = staticIndex.shortcodeMap.get(shortcodeQuery) ?? [];
  for (const match of shortcodeMatches) {
    const entry = reader.searchIndex.get(match.canonicalId);
    if (!entry) {
      continue;
    }
    const production = staticIndex.productionCanonicalById.get(match.canonicalId);
    pushCandidate(candidates, {
      canonicalId: match.canonicalId,
      character: entry.emoji,
      canonicalName: entry.canonicalName,
      matchedField: "shortcode",
      matchedTerm: match.shortcode,
      score: MASTER_SEARCH_SCORE.EXACT_SHORTCODE,
      source: match.shortcodePack,
      isExtra: isExtraCanonical(match.canonicalId, rootDir),
      confidence: 0.98,
      productionId: production?.productionId ?? null,
      productionHexcode: production?.hexcode ?? entry.hexcode,
      provenance: buildProvenance(match.shortcode, match.source, match.canonicalId),
    });
  }

  const semanticTerm = staticIndex.publicSemanticTerms.get(normalized);
  if (semanticTerm) {
    for (const canonicalId of semanticTerm.canonicalIds) {
      const entry = reader.searchIndex.get(canonicalId);
      if (!entry) {
        continue;
      }
      const production = staticIndex.productionCanonicalById.get(canonicalId);
      pushCandidate(candidates, {
        canonicalId,
        character: entry.emoji,
        canonicalName: entry.canonicalName,
        matchedField: "semantic",
        matchedTerm: semanticTerm.term,
        score: MASTER_SEARCH_SCORE.SAFE_SEMANTIC_SYNONYM,
        source: "semantic-search-terms",
        isExtra: isExtraCanonical(canonicalId, rootDir),
        confidence: semanticTerm.confidence,
        productionId: production?.productionId ?? null,
        productionHexcode: production?.hexcode ?? entry.hexcode,
        provenance: buildProvenance(semanticTerm.term, "semantic-search-terms", canonicalId),
      });
    }
  }

  let results = [...candidates.values()]
    .map((result) =>
      result.isExtra
        ? Object.freeze({ ...result, score: Math.max(0, result.score - MASTER_SEARCH_SCORE.EXTRA_PENALTY) })
        : result,
    )
    .sort((left, right) => {
      const compared = compareMasterSearchScores(left, right);
      if (compared !== 0) {
        return compared;
      }
      const leftMapped = staticIndex.productionCanonicalById.has(left.canonicalId);
      const rightMapped = staticIndex.productionCanonicalById.has(right.canonicalId);
      if (leftMapped !== rightMapped) {
        return leftMapped ? -1 : 1;
      }
      return 0;
    });

  if (isLikelyEmojiCharacterQuery(trimmed)) {
    const emojiMatches = results.filter((result) => result.matchedField === "emoji");
    if (emojiMatches.length > 0) {
      results = emojiMatches;
    }
  }

  results = results.slice(0, limit);

  if (normalized === "hot") {
    const fireOnly = results.length === 1 && results[0]?.canonicalId === "unicode:1F525";
    ambiguous = ambiguous || fireOnly;
  }

  return Object.freeze({
    query,
    results: Object.freeze(results),
    ambiguous,
  });
}

export function resolveCanonicalIdFromShortcode(shortcode: string, rootDir?: string): string | null {
  const normalized = resolveShortcodeQuery(shortcode);
  const matches = getMasterSearchStaticIndex(rootDir).shortcodeMap.get(normalized);
  if (!matches || matches.length === 0) {
    return null;
  }
  return matches[0].canonicalId;
}
