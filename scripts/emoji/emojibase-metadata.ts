import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Emoji, ShortcodesDataset } from "emojibase";
import { flattenEmojiData } from "emojibase";
import emojibaseData from "emojibase-data/en/data.json";
import groupDataset from "emojibase-data/meta/groups.json";
import cldrShortcodes from "emojibase-data/en/shortcodes/cldr.json";
import emojibaseLegacyShortcodes from "emojibase-data/en/shortcodes/emojibase-legacy.json";
import emojibaseShortcodes from "emojibase-data/en/shortcodes/emojibase.json";
import githubShortcodes from "emojibase-data/en/shortcodes/github.json";
import iamcalShortcodes from "emojibase-data/en/shortcodes/iamcal.json";
import { toLookupHexcode, uniqueSorted } from "./utils";

export interface EmojibaseMetadata {
  label: string;
  tags: string[];
  shortcodes: string[];
  order?: number;
  group?: string;
  subgroup?: string;
  emojiVersion?: number;
  gender?: 0 | 1;
  skinTone?: 1 | 2 | 3 | 4 | 5 | Array<1 | 2 | 3 | 4 | 5>;
}

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

const DATASET_SHORTCODE_PACKS = [
  emojibaseShortcodes,
] as ShortcodesDataset[];

const SEARCH_SHORTCODE_PACKS = [
  emojibaseShortcodes,
  githubShortcodes,
  cldrShortcodes,
  iamcalShortcodes,
  emojibaseLegacyShortcodes,
] as ShortcodesDataset[];

function toMetadataRecord(emoji: Emoji): EmojibaseMetadata {
  return {
    label: emoji.label,
    tags: emoji.tags ?? [],
    shortcodes: uniqueSorted(emoji.shortcodes ?? []),
    order: emoji.order,
    group:
      emoji.group !== undefined
        ? groupDataset.groups[String(emoji.group) as keyof typeof groupDataset.groups]
        : undefined,
    subgroup:
      emoji.subgroup !== undefined
        ? groupDataset.subgroups[
            String(emoji.subgroup) as keyof typeof groupDataset.subgroups
          ]
        : undefined,
    emojiVersion: emoji.version,
    gender: emoji.gender,
    skinTone: Array.isArray(emoji.tone) ? emoji.tone : emoji.tone,
  };
}

function buildMetadataMap(shortcodePacks: ShortcodesDataset[]): Map<string, EmojibaseMetadata> {
  const flattened = flattenEmojiData(emojibaseData as Emoji[], shortcodePacks);
  const metadata = new Map<string, EmojibaseMetadata>();

  for (const emoji of flattened) {
    const value = toMetadataRecord(emoji);
    const keys = new Set<string>([
      emoji.hexcode.toUpperCase(),
      toLookupHexcode(emoji.hexcode.toUpperCase()),
    ]);

    for (const key of keys) {
      metadata.set(key, value);
    }
  }

  return metadata;
}

export function getEmojibasePackageVersion(): string {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "node_modules",
    "emojibase-data",
    "package.json",
  );
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  return pkg.version;
}

const datasetMetadataByHexcode = buildMetadataMap(DATASET_SHORTCODE_PACKS);
const searchMetadataByHexcode = buildMetadataMap(SEARCH_SHORTCODE_PACKS);

export const emojibaseMetadataByHexcode = datasetMetadataByHexcode;

export function lookupEmojibaseMetadata(hexcode: string): EmojibaseMetadata | undefined {
  return (
    datasetMetadataByHexcode.get(hexcode) ??
    datasetMetadataByHexcode.get(toLookupHexcode(hexcode))
  );
}

export function lookupEmojibaseSearchMetadata(
  hexcode: string,
): EmojibaseSearchMetadataRecord | undefined {
  const metadata =
    searchMetadataByHexcode.get(hexcode) ??
    searchMetadataByHexcode.get(toLookupHexcode(hexcode));

  if (!metadata) {
    return undefined;
  }

  return {
    label: metadata.label,
    tags: metadata.tags,
    shortcodes: metadata.shortcodes,
    group: metadata.group,
    subgroup: metadata.subgroup,
    emojiVersion: metadata.emojiVersion,
    gender: metadata.gender,
    skinTone: metadata.skinTone,
  };
}

export function buildEmojibaseSearchMetadata(
  standardHexcodes: string[],
): EmojibaseSearchMetadataFile {
  const byHexcode: Record<string, EmojibaseSearchMetadataRecord> = {};
  const unmatchedHexcodes: string[] = [];

  for (const hexcode of standardHexcodes) {
    const metadata = lookupEmojibaseSearchMetadata(hexcode);

    if (!metadata) {
      unmatchedHexcodes.push(hexcode);
      continue;
    }

    byHexcode[hexcode] = metadata;
  }

  return {
    emojibaseVersion: getEmojibasePackageVersion(),
    locale: "en",
    generatedAt: new Date().toISOString(),
    stats: {
      totalStandard: standardHexcodes.length,
      matched: standardHexcodes.length - unmatchedHexcodes.length,
      unmatched: unmatchedHexcodes.length,
      unmatchedHexcodes,
    },
    byHexcode,
  };
}

export { groupDataset };
