import type {
  EmojiQualificationStatus,
  EmojiSequenceInfo,
  UnicodeDataSource,
} from "../../src/lib/emoji/types";
import {
  addSource,
  categoryNameToSlug,
  detectSequenceKind,
  hasVariationSelector,
  hasZeroWidthJoiner,
  isRGIStatus,
  parseCodePointField,
  parseEmojiVersionFromComment,
  parseNameFromComment,
  readUnicodeHeaderVersion,
  subgroupCommentToSlug,
  toHexcode,
  toUnicodeCharacter,
} from "./utils";

export interface ParsedEmojiTestEntry {
  codePoints: string[];
  hexcode: string;
  emoji: string;
  status: EmojiQualificationStatus;
  name: string;
  unicodeVersion: string;
  category: string;
  subcategory: string;
  sources: UnicodeDataSource[];
}

const ENTRY_LINE =
  /^([0-9A-F]+(?:\s+[0-9A-F]+)*)\s*;\s*(fully-qualified|minimally-qualified|unqualified|component)\s*#\s*(.+)$/i;

export function parseEmojiTest(content: string): {
  version?: string;
  entries: ParsedEmojiTestEntry[];
} {
  const version = readUnicodeHeaderVersion(content);
  const entries: ParsedEmojiTestEntry[] = [];

  let currentCategory = "";
  let currentSubcategory = "";

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith("#")) {
      const groupMatch = line.match(/^#\s*group:\s*(.+)$/i);
      if (groupMatch) {
        currentCategory = categoryNameToSlug(groupMatch[1]);
        continue;
      }

      const subgroupMatch = line.match(/^#\s*subgroup:\s*(.+)$/i);
      if (subgroupMatch) {
        currentSubcategory = subgroupCommentToSlug(subgroupMatch[1]);
      }

      continue;
    }

    const match = line.match(ENTRY_LINE);
    if (!match) {
      continue;
    }

    const codePoints = parseCodePointField(match[1]);
    const status = match[2].toLowerCase() as EmojiQualificationStatus;
    const comment = match[3].trim();
    const unicodeVersion = parseEmojiVersionFromComment(comment) ?? "unknown";
    const name = parseNameFromComment(comment);

    entries.push({
      codePoints,
      hexcode: toHexcode(codePoints),
      emoji: toUnicodeCharacter(codePoints),
      status,
      name,
      unicodeVersion,
      category: currentCategory,
      subcategory: currentSubcategory,
      sources: ["emoji-test"],
    });
  }

  return { version, entries };
}

export function selectWebsiteEntries(entries: ParsedEmojiTestEntry[]): ParsedEmojiTestEntry[] {
  return entries.filter((entry) => entry.status === "fully-qualified");
}

export function createSequenceInfoFromTest(entry: ParsedEmojiTestEntry): EmojiSequenceInfo {
  return {
    kind: detectSequenceKind(entry.codePoints),
    status: entry.status,
    hasVariationSelector: hasVariationSelector(entry.codePoints),
    hasZeroWidthJoiner: hasZeroWidthJoiner(entry.codePoints),
    isRGI: isRGIStatus(entry.status),
    sources: addSource([], "emoji-test"),
  };
}
