const BMP_PRIVATE_USE_MIN = 0xe000;
const BMP_PRIVATE_USE_MAX = 0xf8ff;
const HEX_CODEPOINT_PATTERN = /^[0-9A-F]{1,6}$/i;
const HEX_SEQUENCE_PATTERN = /^[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})*$/i;

export function isValidHexCodepoint(codepoint: string): boolean {
  if (!HEX_CODEPOINT_PATTERN.test(codepoint)) {
    return false;
  }

  const value = Number.parseInt(codepoint, 16);
  return value >= 0 && value <= 0x10ffff;
}

export function normalizeCodepoint(codepoint: string): string {
  return codepoint.replace(/^U\+/i, "").toUpperCase();
}

export function normalizeCodepointList(codepoints: string[]): string[] {
  return codepoints.map(normalizeCodepoint).filter(Boolean);
}

export function normalizeHexSequence(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/U\+/i.test(trimmed)) {
    const parts = trimmed
      .split(/\s+/)
      .map((part) => normalizeCodepoint(part))
      .filter((part) => isValidHexCodepoint(part));
    return parts.length > 0 ? parts.join("-") : null;
  }

  if (HEX_SEQUENCE_PATTERN.test(trimmed)) {
    const parts = trimmed.split("-").map(normalizeCodepoint);
    if (parts.every(isValidHexCodepoint)) {
      return parts.join("-");
    }
    return null;
  }

  if (HEX_CODEPOINT_PATTERN.test(trimmed) && isValidHexCodepoint(trimmed)) {
    return normalizeCodepoint(trimmed);
  }

  return null;
}

export function sequenceFromCodepoints(codepoints: string[]): string | null {
  const normalized = normalizeCodepointList(codepoints).filter(isValidHexCodepoint);
  return normalized.length > 0 ? normalized.join("-") : null;
}

export function hexcodeToEmoji(hexcode: string): string | null {
  try {
    const parts = hexcode.split("-").filter(Boolean);
    return String.fromCodePoint(...parts.map((part) => Number.parseInt(part, 16)));
  } catch {
    return null;
  }
}

export function emojiToSequence(emoji: string): string | null {
  if (!emoji) {
    return null;
  }

  const codepoints: string[] = [];
  for (const char of emoji) {
    const value = char.codePointAt(0);
    if (value === undefined) {
      continue;
    }
    codepoints.push(value.toString(16).toUpperCase());
  }

  return codepoints.length > 0 ? codepoints.join("-") : null;
}

export function isActualEmojiCharacter(value: string | null): boolean {
  if (!value) {
    return false;
  }

  if (/^[0-9A-Fa-f-]+$/.test(value.trim())) {
    return false;
  }

  for (const char of value) {
    const codepoint = char.codePointAt(0);
    if (codepoint === undefined || codepoint < 0x20 || codepoint === 0x7f) {
      return false;
    }
  }

  return emojiToSequence(value) !== null;
}

export function isBmpPrivateUseCodepoint(codepoint: string): boolean {
  const value = Number.parseInt(normalizeCodepoint(codepoint), 16);
  return value >= BMP_PRIVATE_USE_MIN && value <= BMP_PRIVATE_USE_MAX;
}

export function isPrivateUseSequence(sequence: string): boolean {
  const parts = sequence.split("-").filter(Boolean);
  return parts.length > 0 && parts.every(isBmpPrivateUseCodepoint);
}

export function toUnicodeCanonicalIdentity(sequence: string): string {
  const normalized = normalizeHexSequence(sequence) ?? sequence.toUpperCase();
  return `unicode:${normalized}`;
}

export function extractBareSourceId(source: string, sourceId: string): string {
  const artworkPrefix = `${source}-artwork:`;
  if (sourceId.startsWith(artworkPrefix)) {
    const rest = sourceId.slice(artworkPrefix.length);
    const colonIndex = rest.indexOf(":");
    return colonIndex >= 0 ? rest.slice(0, colonIndex) : rest;
  }

  const prefixes = [`${source}-extra:`, `${source}:`];
  for (const prefix of prefixes) {
    if (sourceId.startsWith(prefix)) {
      return sourceId.slice(prefix.length);
    }
  }

  const firstColon = sourceId.indexOf(":");
  if (firstColon >= 0 && sourceId.slice(0, firstColon) === source) {
    return sourceId.slice(firstColon + 1);
  }

  return sourceId;
}

export function toSourceCanonicalIdentity(source: string, sourceId: string): string {
  return `source:${source}:${extractBareSourceId(source, sourceId)}`;
}

export function classifyUnicodeCategory(sequence: string): "unicode-canonical" | "unicode-sequence" {
  const parts = sequence.split("-").filter(Boolean);
  return parts.length === 1 ? "unicode-canonical" : "unicode-sequence";
}

export function extractHexFromArtworkSourceId(sourceId: string): string | null {
  const artworkMatch = sourceId.match(
    /^(?:openmoji|noto|twemoji|fluent)-artwork:([0-9A-F-]+)(?::|$)/i,
  );
  if (artworkMatch) {
    return normalizeHexSequence(artworkMatch[1]);
  }

  return null;
}

export function extractHexFromNotoFilename(filename: string): string | null {
  const match = filename.match(/^emoji_u([0-9a-f_]+)\./i);
  if (!match) {
    return null;
  }

  const sequence = match[1]
    .split("_")
    .map((part) => part.toUpperCase())
    .join("-");
  return normalizeHexSequence(sequence);
}

export function extractHexFromTwemojiFilename(filename: string): string | null {
  const base = filename.replace(/\.(png|svg)$/i, "");
  return normalizeHexSequence(base);
}

export function extractHexFromOpenmojiPath(path: string): string | null {
  const match = path.match(/\/([0-9A-F-]+)\.svg$/i);
  return match ? normalizeHexSequence(match[1]) : null;
}

export function extractFluentAssetFolder(stagedPath: string): string | null {
  const match = stagedPath.match(/artwork\/fluent\/assets\/([^/]+)\//i);
  return match ? match[1] : null;
}

export interface IdentityResolution {
  canonicalIdentity: string;
  normalizedSequence: string | null;
  identityCategory: import("./types").IdentityCategory;
  mappingMethod: string;
}

export function resolveUnicodeIdentity(
  sequence: string,
  mappingMethod: string,
): IdentityResolution {
  const normalized = normalizeHexSequence(sequence) ?? sequence.toUpperCase();
  return {
    canonicalIdentity: toUnicodeCanonicalIdentity(normalized),
    normalizedSequence: normalized,
    identityCategory: classifyUnicodeCategory(normalized),
    mappingMethod,
  };
}

export function resolvePrivateUseIdentity(
  source: string,
  sourceId: string,
  sequence: string,
  mappingMethod: string,
): IdentityResolution {
  return {
    canonicalIdentity: toSourceCanonicalIdentity(source, sourceId),
    normalizedSequence: normalizeHexSequence(sequence),
    identityCategory: "private-use",
    mappingMethod,
  };
}

export function resolveSourceSpecificIdentity(
  source: string,
  sourceId: string,
  mappingMethod: string,
): IdentityResolution {
  return {
    canonicalIdentity: toSourceCanonicalIdentity(source, sourceId),
    normalizedSequence: null,
    identityCategory: "source-specific",
    mappingMethod,
  };
}

export function resolveUnmatchedIdentity(
  source: string,
  sourceId: string,
  mappingMethod: string,
): IdentityResolution {
  return {
    canonicalIdentity: toSourceCanonicalIdentity(source, sourceId),
    normalizedSequence: null,
    identityCategory: "unmatched",
    mappingMethod,
  };
}
