import type { Phase7UnicodeAnalysis } from "./types";

const SCRIPT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["Latin", /\p{Script=Latin}/u],
  ["Common", /\p{Script=Common}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
  ["Han", /\p{Script=Han}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Cyrillic", /\p{Script=Cyrillic}/u],
];

function blockName(cp: number): string {
  if (cp >= 0x1f300 && cp <= 0x1faff) return "Miscellaneous Symbols and Pictographs";
  if (cp >= 0x2600 && cp <= 0x26ff) return "Miscellaneous Symbols";
  if (cp >= 0x2700 && cp <= 0x27bf) return "Dingbats";
  if (cp >= 0x3040 && cp <= 0x309f) return "Hiragana";
  if (cp >= 0x30a0 && cp <= 0x30ff) return "Katakana";
  if (cp >= 0x4e00 && cp <= 0x9fff) return "CJK Unified Ideographs";
  if (cp >= 0x20 && cp <= 0x7e) return "Basic Latin";
  return "Other";
}

/** Unicode analysis — does not mutate content. */
export function analyzeUnicode(content: string): Phase7UnicodeAnalysis {
  const codePoints = [...content].map((c) => c.codePointAt(0)!);
  const blocks = [...new Set(codePoints.map(blockName))];
  const scripts: string[] = [];
  for (const [name, re] of SCRIPT_PATTERNS) {
    if (re.test(content)) scripts.push(name);
  }
  const hasCombining = /\p{M}/u.test(content);
  const hasZwj = content.includes("\u200D");
  const hasVs = /\uFE0F|\uFE0E/.test(content);
  const hasRi = /\p{Regional_Indicator}/u.test(content);
  const unusual =
    hasZwj ||
    hasRi ||
    codePoints.some((cp) => cp > 0x1ffff) ||
    (codePoints.length > 0 && codePoints.every((cp) => cp < 0x20));

  return {
    code_points: codePoints,
    character_count: content.length,
    code_point_count: codePoints.length,
    has_zwj: hasZwj,
    has_variation_selector: hasVs,
    has_regional_indicator: hasRi,
    has_combining_mark: hasCombining,
    scripts,
    blocks,
    unusual_unicode: unusual,
  };
}
