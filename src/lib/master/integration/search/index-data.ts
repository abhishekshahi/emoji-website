import { getShortcodeIndex } from "../metadata/lazy-data";
import { getMasterReader } from "../master-reader";
import { loadProductionCanonicalRecords } from "../production-map";

export interface ShortcodeIndexEntry {
  readonly canonicalId: string;
  readonly shortcode: string;
  readonly normalizedShortcode: string;
  readonly source: string;
  readonly shortcodePack: string;
}

export interface MasterSearchStaticIndex {
  readonly shortcodeMap: ReadonlyMap<string, readonly ShortcodeIndexEntry[]>;
  readonly publicSemanticTerms: ReadonlyMap<string, { term: string; canonicalIds: readonly string[]; confidence: number }>;
  readonly productionCanonicalById: ReadonlyMap<string, { hexcode: string; productionType: "standard" | "extra"; productionId: string }>;
}

let staticIndex: MasterSearchStaticIndex | null = null;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function stripShortcodeDelimiters(query: string): string | null {
  const match = query.trim().match(/^:([a-z0-9_+-]+):$/i);
  return match ? match[1].toLowerCase() : null;
}

export function getMasterSearchStaticIndex(rootDir: string = process.cwd()): MasterSearchStaticIndex {
  if (staticIndex) {
    return staticIndex;
  }

  const reader = getMasterReader(rootDir);
  const shortcodeMap = new Map<string, ShortcodeIndexEntry[]>();

  for (const [canonicalId, entry] of getShortcodeIndex(rootDir)) {
    for (const shortcode of entry.shortcodes) {
      const normalized = shortcode.normalizedShortcode.toLowerCase();
      const bucket = shortcodeMap.get(normalized) ?? [];
      bucket.push(
        Object.freeze({
          canonicalId,
          shortcode: shortcode.shortcode,
          normalizedShortcode: normalized,
          source: shortcode.source,
          shortcodePack: shortcode.shortcodePack,
        }),
      );
      shortcodeMap.set(normalized, bucket);
    }
  }

  const publicSemanticTerms = new Map<string, { term: string; canonicalIds: readonly string[]; confidence: number }>();
  for (const [normalizedTerm, term] of reader.semanticSearchTerms) {
    if (term.publicSearch && !term.ambiguous) {
      publicSemanticTerms.set(normalizedTerm, Object.freeze({
        term: term.term,
        canonicalIds: Object.freeze([...term.canonicalIds]),
        confidence: term.confidence,
      }));
    }
  }

  const productionCanonicalById = new Map<string, { hexcode: string; productionType: "standard" | "extra"; productionId: string }>();
  for (const [canonicalId, record] of loadProductionCanonicalRecords(rootDir)) {
    productionCanonicalById.set(canonicalId, {
      hexcode: record.productionHexcode,
      productionType: record.productionType,
      productionId: record.productionId,
    });
  }

  staticIndex = Object.freeze({
    shortcodeMap,
    publicSemanticTerms,
    productionCanonicalById,
  });

  return staticIndex;
}

export function resetMasterSearchStaticIndex(): void {
  staticIndex = null;
}

export function resolveShortcodeQuery(query: string): string {
  return stripShortcodeDelimiters(query) ?? normalizeQuery(query);
}

export function resolveCodePointQuery(query: string): string | null {
  const trimmed = query.trim();
  const unicodeMatch = trimmed.match(/^u\+([0-9a-f]+(?:\s*-\s*[0-9a-f]+)*)$/i);
  if (unicodeMatch) {
    return unicodeMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  const hexOnly = trimmed.match(/^([0-9a-f]{4,}(?:[-\s][0-9a-f]{4,})*)$/i);
  if (hexOnly) {
    return hexOnly[1].replace(/[-\s]/g, "").toUpperCase();
  }

  return null;
}
