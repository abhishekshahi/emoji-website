import emojibaseMetadataFile from "@/data/emojibase-metadata.json";

export interface EmojibaseSearchMetadataRecord {
  label: string;
  tags: string[];
  shortcodes: string[];
  group?: string;
  subgroup?: string;
  emojiVersion?: number;
  gender?: 0 | 1;
  skinTone?: 1 | 2 | 3 | 4 | 5 | Array<1 | 2 | 3 | 4 | 5>;
}

export interface EmojibaseSearchMetadataFile {
  emojibaseVersion: string;
  locale: "en";
  generatedAt: string;
  stats: {
    totalStandard: number;
    matched: number;
    unmatched: number;
    unmatchedHexcodes: string[];
  };
  byHexcode: Record<string, EmojibaseSearchMetadataRecord>;
}

const metadataFile = emojibaseMetadataFile as EmojibaseSearchMetadataFile;

export function getEmojibaseMetadataVersion(): string {
  return metadataFile.emojibaseVersion;
}

export function getEmojibaseMetadataStats(): EmojibaseSearchMetadataFile["stats"] {
  return metadataFile.stats;
}

export function getEmojibaseMetadataByHexcode(): Readonly<
  Record<string, EmojibaseSearchMetadataRecord>
> {
  return metadataFile.byHexcode;
}

export function lookupEmojibaseSearchMetadata(
  hexcode: string,
): EmojibaseSearchMetadataRecord | undefined {
  return (
    metadataFile.byHexcode[hexcode] ??
    metadataFile.byHexcode[stripVariationSelectors(hexcode)]
  );
}

function stripVariationSelectors(hexcode: string): string {
  return hexcode
    .split("-")
    .filter((part) => part !== "FE0F" && part !== "FE0E")
    .join("-");
}
