import type { NormalizationChange } from "../types";

export const NORMALIZATION_VERSION = "1.0.0";

const HTML_ENTITY_PATTERN = /&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g;

const COMMON_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export interface NormalizeResult {
  readonly original_kaomoji: string;
  readonly normalized_kaomoji: string;
  readonly normalization_version: string;
  readonly normalization_method: string;
  readonly normalization_changes: readonly NormalizationChange[];
  readonly normalization_warnings: readonly string[];
}

function decodeHtmlEntity(match: string, dec: string, hex: string, named: string): string {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  if (named) {
    const decoded = COMMON_NAMED_ENTITIES[named.toLowerCase()];
    if (decoded !== undefined) return decoded;
  }
  return match;
}

/** Normalize kaomoji while preserving intentional spaces and punctuation. */
export function normalizeKaomoji(original: string): NormalizeResult {
  const changes: NormalizationChange[] = [];
  const warnings: string[] = [];
  let value = original;

  const lineEndingNormalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (lineEndingNormalized !== value) {
    changes.push({ kind: "line_ending", before: value, after: lineEndingNormalized });
    value = lineEndingNormalized;
  }

  const htmlStripped = value.replace(HTML_ENTITY_PATTERN, (match, dec, hex, named) => {
    const decoded = decodeHtmlEntity(match, dec, hex, named);
    if (decoded !== match) {
      changes.push({ kind: "html", before: match, after: decoded });
    } else if (named) {
      warnings.push(`unrecognized_html_entity:${match}`);
    }
    return decoded;
  });
  value = htmlStripped;

  const nfcNormalized = value.normalize("NFC");
  if (nfcNormalized !== value) {
    changes.push({ kind: "unicode", before: value, after: nfcNormalized });
    value = nfcNormalized;
  }

  const trimmedEnds = value.replace(/^\s+|\s+$/g, "");
  if (trimmedEnds !== value) {
    changes.push({ kind: "whitespace", before: value, after: trimmedEnds });
    value = trimmedEnds;
  }

  if (value.includes("\n") || value.includes("\t")) {
    warnings.push("contains_internal_whitespace");
  }

  return {
    original_kaomoji: original,
    normalized_kaomoji: value,
    normalization_version: NORMALIZATION_VERSION,
    normalization_method: "phase1-nfc-html-line-ending",
    normalization_changes: changes,
    normalization_warnings: warnings,
  };
}
