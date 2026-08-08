import type { UnicodeSequenceType } from "../../src/lib/emoji/types";
import {
  expandCodePointRanges,
  parseCodePointField,
  parseEmojiVersionFromComment,
  parseNameFromComment,
  readUnicodeHeaderVersion,
  toHexcode,
} from "./utils";

export interface ParsedSequenceEntry {
  codePoints: string[];
  hexcode: string;
  sequenceType: UnicodeSequenceType;
  name: string;
  unicodeVersion: string;
}

const SEQUENCE_LINE =
  /^([0-9A-F]+(?:\.\.[0-9A-F]+)?(?:\s+[0-9A-F]+(?:\.\.[0-9A-F]+)?)*)\s*;\s*([^;]+);\s*(.+)$/i;

const SEQUENCE_TYPES = new Set<UnicodeSequenceType>([
  "Basic_Emoji",
  "Emoji_Keycap_Sequence",
  "RGI_Emoji_Flag_Sequence",
  "RGI_Emoji_Tag_Sequence",
  "RGI_Emoji_Modifier_Sequence",
  "RGI_Emoji_ZWJ_Sequence",
]);

function parseSequenceType(value: string): UnicodeSequenceType | undefined {
  const normalized = value.trim() as UnicodeSequenceType;
  return SEQUENCE_TYPES.has(normalized) ? normalized : undefined;
}

function parseSequenceField(field: string): string[][] {
  const parts = field.trim().split(/\s+/);
  const sequences: string[][] = [];
  let buffer: string[] = [];

  for (const part of parts) {
    if (part.includes("..")) {
      if (buffer.length > 0) {
        sequences.push(buffer);
        buffer = [];
      }

      sequences.push(...expandCodePointRanges(part));
      continue;
    }

    buffer.push(part);
  }

  if (buffer.length > 0) {
    sequences.push(parseCodePointField(buffer.join(" ")));
  }

  return sequences;
}

export function parseEmojiSequences(content: string): {
  version?: string;
  entries: ParsedSequenceEntry[];
} {
  const version = readUnicodeHeaderVersion(content);
  const entries: ParsedSequenceEntry[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(SEQUENCE_LINE);
    if (!match) {
      continue;
    }

    const sequenceType = parseSequenceType(match[2]);
    if (!sequenceType) {
      continue;
    }

    const description = match[3].trim();
    const unicodeVersion = parseEmojiVersionFromComment(description) ?? "unknown";
    const name = parseNameFromComment(description);
    const codePointGroups = parseSequenceField(match[1]);

    for (const codePoints of codePointGroups) {
      entries.push({
        codePoints,
        hexcode: toHexcode(codePoints),
        sequenceType,
        name,
        unicodeVersion,
      });
    }
  }

  return { version, entries };
}
