import {
  BIDI_CONTROL_CHARACTERS,
  charFromCodePoint,
  CHARACTER_BY_CODEPOINT,
  formatCodePoint,
  GENERATOR_CHARACTERS,
  isInvisibleForDisplay,
  lookupCharacterName,
} from "./characters";

export const MAX_INPUT_LENGTH = 10_000 as const;

export interface AnalyzedSegment {
  readonly index: number;
  readonly char: string;
  readonly codePoint: number;
  readonly codePointLabel: string;
  readonly name: string;
  readonly category: string;
  readonly isInvisible: boolean;
  readonly isBidiControl: boolean;
  readonly caution: string | null;
  readonly visibleLabel: string;
}

export interface TextAnalysisResult {
  readonly original: string;
  readonly segments: readonly AnalyzedSegment[];
  readonly utf16Units: number;
  readonly unicodeCodePoints: number;
  readonly graphemeClusters: number | null;
  readonly graphemeMethod: "Intl.Segmenter" | "code-point-fallback";
  readonly invisibleCount: number;
  readonly bidiControlCount: number;
  readonly warnings: readonly string[];
}

export interface CleanResult {
  readonly original: string;
  readonly cleaned: string;
  readonly removedCount: number;
  readonly removedByCodePoint: Readonly<Record<string, number>>;
}

const BIDI_SET = new Set(BIDI_CONTROL_CHARACTERS.map((c) => c.codePoint));

function countGraphemes(text: string): { count: number; method: TextAnalysisResult["graphemeMethod"] } {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let count = 0;
    for (const _ of segmenter.segment(text)) count += 1;
    return { count, method: "Intl.Segmenter" };
  }
  return { count: [...text].length, method: "code-point-fallback" };
}

export function boundInput(text: string): string {
  return text.slice(0, MAX_INPUT_LENGTH);
}

export function analyzeText(input: string): TextAnalysisResult {
  const original = boundInput(input);
  const segments: AnalyzedSegment[] = [];
  const warnings: string[] = [];
  let invisibleCount = 0;
  let bidiControlCount = 0;

  let index = 0;
  for (const char of original) {
    const cp = char.codePointAt(0)!;
    const defn = CHARACTER_BY_CODEPOINT.get(cp);
    const isBidi = BIDI_SET.has(cp);
    const invisible = isInvisibleForDisplay(cp);
    if (invisible) invisibleCount += 1;
    if (isBidi) {
      bidiControlCount += 1;
      warnings.push(`${formatCodePoint(cp)} (${lookupCharacterName(cp)}) — bidi control detected.`);
    }
    segments.push({
      index,
      char,
      codePoint: cp,
      codePointLabel: formatCodePoint(cp),
      name: defn?.name ?? lookupCharacterName(cp),
      category: defn?.category ?? "Other",
      isInvisible: invisible,
      isBidiControl: isBidi,
      caution: defn?.caution ?? (isBidi ? "Bidirectional control — verify text is trustworthy." : null),
      visibleLabel: invisible ? `[${defn?.shortLabel ?? formatCodePoint(cp)}]` : char,
    });
    index += char.length;
  }

  if (bidiControlCount > 0) {
    warnings.unshift(
      "This text contains bidirectional control characters that can change visual order. Do not trust displayed order alone.",
    );
  }

  const grapheme = countGraphemes(original);

  return {
    original,
    segments,
    utf16Units: original.length,
    unicodeCodePoints: segments.length,
    graphemeClusters: grapheme.count,
    graphemeMethod: grapheme.method,
    invisibleCount,
    bidiControlCount,
    warnings: [...new Set(warnings)],
  };
}

export function visualizeText(input: string): string {
  const analysis = analyzeText(input);
  return analysis.segments.map((s) => s.visibleLabel).join("");
}

export function cleanText(input: string, removeCodePoints: ReadonlySet<number>): CleanResult {
  const original = boundInput(input);
  const removedByCodePoint: Record<string, number> = {};
  let removedCount = 0;
  let cleaned = "";

  for (const char of original) {
    const cp = char.codePointAt(0)!;
    if (removeCodePoints.has(cp)) {
      removedCount += 1;
      const key = formatCodePoint(cp);
      removedByCodePoint[key] = (removedByCodePoint[key] ?? 0) + 1;
      continue;
    }
    cleaned += char;
  }

  return { original, cleaned, removedCount, removedByCodePoint };
}

export function defaultRemovableSet(includeBidi: boolean): ReadonlySet<number> {
  const set = new Set<number>();
  for (const c of GENERATOR_CHARACTERS) set.add(c.codePoint);
  set.add(0x00ad); // soft hyphen
  if (includeBidi) {
    for (const c of BIDI_CONTROL_CHARACTERS) set.add(c.codePoint);
  }
  return set;
}

export function charLiteral(hex: string): string {
  return charFromCodePoint(Number.parseInt(hex, 16));
}
