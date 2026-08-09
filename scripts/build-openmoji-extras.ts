import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  EmojiCategory,
  EmojiSequenceInfo,
  OpenMojiExtraRecord,
  OpenMojiExtrasManifest,
} from "../src/lib/emoji/types";
import {
  detectSequenceKind,
  hasVariationSelector,
  hasZeroWidthJoiner,
  toCodePointString,
  toSlug,
} from "./emoji/utils";

interface OpenMojiJsonEntry {
  emoji: string;
  hexcode: string;
  group: string;
  subgroups: string;
  annotation: string;
  openmoji_tags?: string;
  openmoji_author?: string;
  openmoji_date?: string;
  unicode?: string;
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openmojiJsonPath = join(
  rootDir,
  "node_modules",
  "openmoji",
  "data",
  "openmoji.json",
);
const outputDir = join(rootDir, "src", "data");

const EXTRA_SUBGROUP_LABELS: Record<string, string> = {
  "animals-nature": "Animals & Nature",
  brand: "Brands",
  "climate-environment": "Climate & Environment",
  emergency: "Emergency",
  flags: "Flags",
  "food-drink": "Food & Drink",
  gardening: "Gardening",
  healthcare: "Healthcare",
  interaction: "Interaction",
  objects: "Objects",
  people: "People",
  "queer-symbols": "Queer Symbols",
  "regional-indicator": "Regional Indicators",
  "smileys-emotion": "Smileys & Emotion",
  "subdivision-flag": "Subdivision Flags",
  "symbol-other": "Symbols",
  symbols: "Symbols",
  technology: "Technology",
  "travel-places": "Travel & Places",
  "ui-element": "UI Elements",
};

const EXTRA_SUBGROUP_EMOJIS: Record<string, string> = {
  "animals-nature": "🐠",
  brand: "📱",
  "climate-environment": "🌍",
  emergency: "🚨",
  flags: "🏳️",
  "food-drink": "🍽️",
  gardening: "🌱",
  healthcare: "🏥",
  interaction: "👆",
  objects: "📦",
  people: "🧑",
  "queer-symbols": "🏳️‍🌈",
  "regional-indicator": "🇦",
  "smileys-emotion": "😊",
  "subdivision-flag": "🏴",
  "symbol-other": "⬜",
  symbols: "🔣",
  technology: "💻",
  "travel-places": "🧳",
  "ui-element": "🖱️",
};

function normalizeHexPart(part: string): string {
  const upper = part.trim().toUpperCase();
  return upper.length <= 4 ? upper.padStart(4, "0") : upper;
}

function normalizeHexcode(hexcode: string): string {
  return hexcode.split("-").map(normalizeHexPart).join("-");
}

function formatName(annotation: string): string {
  return annotation
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseKeywords(tags: string | undefined, annotation: string): string[] {
  const values = new Set<string>();

  if (tags?.trim()) {
    for (const tag of tags.split(",")) {
      const trimmed = tag.trim();
      if (trimmed) {
        values.add(trimmed);
      }
    }
  }

  for (const word of annotation.split(/[\s-]+/)) {
    const trimmed = word.trim().toLowerCase();
    if (trimmed.length > 2) {
      values.add(trimmed);
    }
  }

  values.add("openmoji extra");
  values.add(annotation.trim().toLowerCase());

  return [...values].sort((left, right) => left.localeCompare(right));
}

function buildSequenceInfo(codePoints: string[]): EmojiSequenceInfo {
  return {
    kind: detectSequenceKind(codePoints),
    status: "unqualified",
    hasVariationSelector: hasVariationSelector(codePoints),
    hasZeroWidthJoiner: hasZeroWidthJoiner(codePoints),
    isRGI: false,
    sources: [],
  };
}

function subgroupToCategoryId(subgroup: string): string {
  return `extra-${subgroup}`;
}

function subgroupLabel(subgroup: string): string {
  return EXTRA_SUBGROUP_LABELS[subgroup] ?? formatName(subgroup);
}

function main(): void {
  const openmojiPackage = JSON.parse(
    readFileSync(
      join(rootDir, "node_modules", "openmoji", "package.json"),
      "utf8",
    ),
  ) as { version: string };

  const openmojiData = JSON.parse(
    readFileSync(openmojiJsonPath, "utf8"),
  ) as OpenMojiJsonEntry[];

  const extraEntries = openmojiData.filter((entry) =>
    entry.group?.startsWith("extras"),
  );

  const slugOwners = new Map<string, string>();
  const records: OpenMojiExtraRecord[] = [];

  for (const entry of extraEntries) {
    const hexcode = normalizeHexcode(entry.hexcode);
    const codePoints = hexcode.split("-");
    const subgroup = entry.subgroups?.trim() || "symbol-other";
    const category = subgroupToCategoryId(subgroup);
    const name = formatName(entry.annotation);
    const id = `extra-${hexcode}`;
    const baseSlug = `extra-${toSlug(entry.annotation)}`;
    const slug = slugOwners.has(baseSlug)
      ? `${baseSlug}-${hexcode.replace(/-/g, "").toLowerCase()}`
      : baseSlug;
    slugOwners.set(slug, id);

    const openmojiGroup =
      entry.group === "extras-unicode" ? "extras-unicode" : "extras-openmoji";

    records.push({
      id,
      emoji: entry.emoji,
      name,
      slug,
      category,
      subcategory: subgroup,
      keywords: parseKeywords(entry.openmoji_tags, entry.annotation),
      shortcodes: [],
      unicodeVersion: entry.unicode?.trim() || "OpenMoji Extra",
      codePoints,
      codePointsDecimal: codePoints.map((codePoint) =>
        Number.parseInt(codePoint, 16),
      ),
      codePointString: toCodePointString(codePoints),
      hexcode,
      sequence: buildSequenceInfo(codePoints),
      openmojiGroup,
      openmojiAuthor: entry.openmoji_author?.trim() || "OpenMoji contributors",
      openmojiDate: entry.openmoji_date?.trim() || "",
      isOpenMojiExtra: true,
    });
  }

  records.sort((left, right) => left.name.localeCompare(right.name));

  const categoriesMap = new Map<string, EmojiCategory>();

  for (const record of records) {
    const existing =
      categoriesMap.get(record.category) ??
      ({
        id: record.category,
        label: `${subgroupLabel(record.subcategory)} (OpenMoji Extra)`,
        subcategories: [],
      } satisfies EmojiCategory);

    if (
      !existing.subcategories.some(
        (subcategory) => subcategory.id === record.subcategory,
      )
    ) {
      existing.subcategories.push({
        id: record.subcategory,
        label: subgroupLabel(record.subcategory),
      });
    }

    categoriesMap.set(record.category, existing);
  }

  const categories = [...categoriesMap.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  const manifest: OpenMojiExtrasManifest = {
    generatedAt: new Date().toISOString(),
    openmojiVersion: openmojiPackage.version,
    recordCount: records.length,
    categoryCount: categories.length,
    openmojiGroupCounts: {
      "extras-openmoji": records.filter(
        (record) => record.openmojiGroup === "extras-openmoji",
      ).length,
      "extras-unicode": records.filter(
        (record) => record.openmojiGroup === "extras-unicode",
      ).length,
    },
    categories,
    subgroupLabels: EXTRA_SUBGROUP_LABELS,
    subgroupEmojis: EXTRA_SUBGROUP_EMOJIS,
    indexes: {
      bySlug: Object.fromEntries(records.map((record) => [record.slug, record.id])),
      byHexcode: Object.fromEntries(
        records.map((record) => [record.hexcode, record.id]),
      ),
    },
  };

  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    join(outputDir, "openmoji-extras.json"),
    `${JSON.stringify(records)}\n`,
    "utf8",
  );

  writeFileSync(
    join(outputDir, "openmoji-extras-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${records.length} OpenMoji extra records.`);
  console.log(`Categories: ${categories.length}`);
  console.log(
    `Groups: openmoji=${manifest.openmojiGroupCounts["extras-openmoji"]}, unicode=${manifest.openmojiGroupCounts["extras-unicode"]}`,
  );
  console.log(`Output: ${outputDir}`);
}

main();
