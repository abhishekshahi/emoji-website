/** Shared invisible / format-character definitions for tools and search normalization. */

export interface UnicodeCharacterDef {
  readonly codePoint: number;
  readonly hex: string;
  readonly name: string;
  readonly shortLabel: string;
  readonly category: string;
  readonly usage: string;
  readonly caution?: string;
  readonly generatorEnabled: boolean;
}

function cp(hex: string): number {
  return Number.parseInt(hex, 16);
}

function def(
  hex: string,
  name: string,
  shortLabel: string,
  category: string,
  usage: string,
  options: { caution?: string; generatorEnabled?: boolean } = {},
): UnicodeCharacterDef {
  const codePoint = cp(hex);
  return {
    codePoint,
    hex: hex.toUpperCase(),
    name,
    shortLabel,
    category,
    usage,
    caution: options.caution,
    generatorEnabled: options.generatorEnabled ?? false,
  };
}

/** Generator-supported invisible characters (spec Part 2). */
export const GENERATOR_CHARACTERS: readonly UnicodeCharacterDef[] = [
  def("200B", "ZERO WIDTH SPACE", "ZWSP", "Format", "Word boundary hint without visible space.", {
    generatorEnabled: true,
  }),
  def("200C", "ZERO WIDTH NON-JOINER", "ZWNJ", "Format", "Prevents cursive joining in scripts like Arabic.", {
    generatorEnabled: true,
  }),
  def("200D", "ZERO WIDTH JOINER", "ZWJ", "Format", "Joins characters — used in emoji sequences (e.g. family, skin tones).", {
    generatorEnabled: true,
    caution: "Do not strip ZWJ from emoji sequences unless you intend to change meaning.",
  }),
  def("2060", "WORD JOINER", "WJ", "Format", "Prevents line break between adjacent characters.", {
    generatorEnabled: true,
  }),
  def("FEFF", "ZERO WIDTH NO-BREAK SPACE", "BOM/ZWNBSP", "Format", "Byte order mark at file start; not recommended as a general invisible spacer.", {
    generatorEnabled: true,
    caution: "Historically used as BOM. Do not use as a general invisible space substitute.",
  }),
];

export const BIDI_CONTROL_CHARACTERS: readonly UnicodeCharacterDef[] = [
  def("202A", "LEFT-TO-RIGHT EMBEDDING", "LRE", "Bidirectional", "Legacy bidi embedding control.", {
    caution: "Can alter visual text order — potential spoofing risk.",
  }),
  def("202B", "RIGHT-TO-LEFT EMBEDDING", "RLE", "Bidirectional", "Legacy bidi embedding control.", {
    caution: "Can alter visual text order — potential spoofing risk.",
  }),
  def("202C", "POP DIRECTIONAL FORMATTING", "PDF", "Bidirectional", "Ends legacy embedding/override.", {
    caution: "Bidi control — inspect carefully in untrusted text.",
  }),
  def("202D", "LEFT-TO-RIGHT OVERRIDE", "LRO", "Bidirectional", "Forces left-to-right display.", {
    caution: "Can hide malicious text direction — high spoofing risk.",
  }),
  def("202E", "RIGHT-TO-LEFT OVERRIDE", "RLO", "Bidirectional", "Forces right-to-left display.", {
    caution: "Can hide malicious text direction — high spoofing risk.",
  }),
  def("2066", "LEFT-TO-RIGHT ISOLATE", "LRI", "Bidirectional", "Isolates a left-to-right run.", {
    caution: "Bidi isolate — verify intent in identifiers.",
  }),
  def("2067", "RIGHT-TO-LEFT ISOLATE", "RLI", "Bidirectional", "Isolates a right-to-left run.", {
    caution: "Bidi isolate — verify intent in identifiers.",
  }),
  def("2068", "FIRST STRONG ISOLATE", "FSI", "Bidirectional", "Isolates using first strong character.", {
    caution: "Bidi isolate — verify intent in identifiers.",
  }),
  def("2069", "POP DIRECTIONAL ISOLATE", "PDI", "Bidirectional", "Ends bidi isolate.", {
    caution: "Bidi control — inspect carefully in untrusted text.",
  }),
];

export const WHITESPACE_CHARACTERS: readonly UnicodeCharacterDef[] = [
  def("0020", "SPACE", "SPACE", "Whitespace", "Standard ASCII space."),
  def("0009", "CHARACTER TABULATION", "TAB", "Whitespace", "Horizontal tab."),
  def("000A", "LINE FEED", "LF", "Whitespace", "New line."),
  def("000D", "CARRIAGE RETURN", "CR", "Whitespace", "Carriage return."),
  def("00A0", "NO-BREAK SPACE", "NBSP", "Whitespace", "Space that prevents line break."),
  def("2009", "THIN SPACE", "THIN SPACE", "Whitespace", "Narrow space punctuation."),
  def("202F", "NARROW NO-BREAK SPACE", "NNBSP", "Whitespace", "Narrow no-break space."),
  def("00AD", "SOFT HYPHEN", "SHY", "Format", "Optional hyphenation hint — often invisible.", {
    caution: "May appear invisible depending on font and context.",
  }),
];

const ALL = [...GENERATOR_CHARACTERS, ...BIDI_CONTROL_CHARACTERS, ...WHITESPACE_CHARACTERS];

export const CHARACTER_BY_CODEPOINT = new Map<number, UnicodeCharacterDef>(
  ALL.map((c) => [c.codePoint, c]),
);

export const GENERATOR_BY_HEX = new Map<string, UnicodeCharacterDef>(
  GENERATOR_CHARACTERS.map((c) => [c.hex, c]),
);

/** Characters stripped by kaomoji search normalization. */
export const NORMALIZED_ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u00AD]/g;

export function charFromCodePoint(cp: number): string {
  return String.fromCodePoint(cp);
}

export function formatCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function isInvisibleForDisplay(cp: number): boolean {
  if (cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d) return false;
  if (CHARACTER_BY_CODEPOINT.has(cp)) return true;
  if (cp >= 0x200b && cp <= 0x200f) return true;
  if (cp >= 0x202a && cp <= 0x202e) return true;
  if (cp >= 0x2060 && cp <= 0x2069) return true;
  if (cp === 0xfeff || cp === 0x00ad) return true;
  return false;
}

export function lookupCharacterName(cp: number): string {
  return CHARACTER_BY_CODEPOINT.get(cp)?.name ?? `U+${cp.toString(16).toUpperCase()}`;
}
