import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Emoji, ShortcodesDataset } from "emojibase";
import { flattenEmojiData } from "emojibase";
import emojibaseData from "emojibase-data/en/data.json";
import groupDataset from "emojibase-data/meta/groups.json";
import shortcodeDataset from "emojibase-data/en/shortcodes/emojibase.json";
import { toLookupHexcode } from "./utils";

export interface EmojibaseMetadata {
  label: string;
  tags: string[];
  shortcodes: string[];
  order?: number;
  group?: string;
  subgroup?: string;
  gender?: 0 | 1;
  skinTone?: 1 | 2 | 3 | 4 | 5 | Array<1 | 2 | 3 | 4 | 5>;
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

function buildMetadataMap(): Map<string, EmojibaseMetadata> {
  const flattened = flattenEmojiData(
    emojibaseData as Emoji[],
    [shortcodeDataset as ShortcodesDataset],
  );
  const metadata = new Map<string, EmojibaseMetadata>();

  for (const emoji of flattened) {
    const keys = new Set<string>([
      emoji.hexcode.toUpperCase(),
      toLookupHexcode(emoji.hexcode.toUpperCase()),
    ]);

    const value: EmojibaseMetadata = {
      label: emoji.label,
      tags: emoji.tags ?? [],
      shortcodes: emoji.shortcodes ?? [],
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
      gender: emoji.gender,
      skinTone: Array.isArray(emoji.tone) ? emoji.tone : emoji.tone,
    };

    for (const key of keys) {
      metadata.set(key, value);
    }
  }

  return metadata;
}

export const emojibaseMetadataByHexcode = buildMetadataMap();

export function lookupEmojibaseMetadata(hexcode: string): EmojibaseMetadata | undefined {
  return (
    emojibaseMetadataByHexcode.get(hexcode) ??
    emojibaseMetadataByHexcode.get(toLookupHexcode(hexcode))
  );
}

export { groupDataset };
