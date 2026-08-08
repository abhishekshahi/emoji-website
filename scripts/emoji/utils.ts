import type {
  EmojiQualificationStatus,
  EmojiSequenceKind,
  UnicodeDataSource,
} from "../../src/lib/emoji/types";

const SKIN_TONE_HEXES = new Set([
  "1F3FB",
  "1F3FC",
  "1F3FD",
  "1F3FE",
  "1F3FF",
]);

const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;
const VARIATION_SELECTORS = new Set(["FE0E", "FE0F"]);
const ZWJ = "200D";
const KEYCAP = "20E3";
const FEMALE_SIGN = "2640";
const MALE_SIGN = "2642";

export function normalizeHexToken(token: string): string {
  const trimmed = token.trim().toUpperCase();
  return trimmed.length <= 4 ? trimmed.padStart(4, "0") : trimmed;
}

export function parseCodePointField(field: string): string[] {
  return field
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeHexToken);
}

export function expandCodePointRanges(field: string): string[][] {
  const trimmed = field.trim();

  if (!trimmed.includes("..")) {
    return [parseCodePointField(trimmed)];
  }

  const [startRaw, endRaw] = trimmed.split("..");
  const start = Number.parseInt(startRaw, 16);
  const end = Number.parseInt(endRaw, 16);
  const sequences: string[][] = [];

  for (let codePoint = start; codePoint <= end; codePoint += 1) {
    sequences.push([codePoint.toString(16).toUpperCase().padStart(4, "0")]);
  }

  return sequences;
}

export function toHexcode(codePoints: string[]): string {
  return codePoints.join("-");
}

export function toUnicodeCharacter(codePoints: string[]): string {
  return String.fromCodePoint(
    ...codePoints.map((codePoint) => Number.parseInt(codePoint, 16)),
  );
}

export function toCodePointString(codePoints: string[]): string {
  return codePoints.map((codePoint) => `U+${codePoint}`).join(" ");
}

export function toLookupHexcode(hexcode: string): string {
  return hexcode
    .split("-")
    .filter((part) => !VARIATION_SELECTORS.has(part))
    .join("-");
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function categoryNameToSlug(name: string): string {
  return toSlug(name);
}

export function subgroupCommentToSlug(comment: string): string {
  return comment.trim().toLowerCase().replace(/\s+/g, "-");
}

export function detectSequenceKind(codePoints: string[]): EmojiSequenceKind {
  if (codePoints.length === 1) {
    return "single";
  }

  if (codePoints.includes(KEYCAP) || codePoints.at(-1) === KEYCAP) {
    return "keycap";
  }

  if (
    codePoints.length === 2 &&
    codePoints.every((codePoint) => {
      const value = Number.parseInt(codePoint, 16);
      return value >= REGIONAL_INDICATOR_START && value <= REGIONAL_INDICATOR_END;
    })
  ) {
    return "flag";
  }

  if (codePoints.some((codePoint) => SKIN_TONE_HEXES.has(codePoint))) {
    return "skin-tone";
  }

  if (
    codePoints.includes(ZWJ) &&
    (codePoints.includes(FEMALE_SIGN) || codePoints.includes(MALE_SIGN))
  ) {
    return "gender";
  }

  if (codePoints.includes(ZWJ)) {
    return "zwj";
  }

  return "multi";
}

export function hasVariationSelector(codePoints: string[]): boolean {
  return codePoints.some((codePoint) => VARIATION_SELECTORS.has(codePoint));
}

export function hasZeroWidthJoiner(codePoints: string[]): boolean {
  return codePoints.includes(ZWJ);
}

export function isRGIStatus(status: EmojiQualificationStatus): boolean {
  return status === "fully-qualified" || status === "component";
}

export function parseEmojiVersionFromComment(comment: string): string | undefined {
  const match = comment.match(/\bE(\d+(?:\.\d+)?)\b/);
  return match?.[1];
}

export function parseNameFromComment(comment: string): string {
  const withoutVersion = comment.replace(/\bE\d+(?:\.\d+)?\b/g, "").trim();
  const withoutLeadingEmoji = withoutVersion.replace(/^[^\s]+\s+/, "");
  return withoutLeadingEmoji.trim();
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function addSource(
  sources: UnicodeDataSource[],
  source: UnicodeDataSource,
): UnicodeDataSource[] {
  if (sources.includes(source)) {
    return sources;
  }

  return [...sources, source];
}

export function readUnicodeHeaderVersion(content: string): string | undefined {
  const match = content.match(/^#\s*Version:\s*([0-9.]+)\s*$/m);
  return match?.[1];
}
