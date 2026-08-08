import type {
  EmojiCategory,
  EmojiDataset,
  EmojiDatasetManifest,
  EmojiRecord,
  EmojiSequenceKind,
} from "../../src/lib/emoji/types";
import {
  getEmojibasePackageVersion,
  lookupEmojibaseMetadata,
} from "./emojibase-metadata";
import { parseEmojiSequences } from "./parse-emoji-sequences";
import {
  createSequenceInfoFromTest,
  parseEmojiTest,
  selectWebsiteEntries,
  type ParsedEmojiTestEntry,
} from "./parse-emoji-test";
import type { ParsedSequenceEntry } from "./parse-emoji-sequences";
import {
  addSource,
  toCodePointString,
  toLookupHexcode,
  toSlug,
  uniqueSorted,
} from "./utils";

interface BuildValidationResult {
  duplicateIds: string[];
  duplicateSlugs: string[];
}

function buildSequenceRegistry(
  sequenceEntries: ParsedSequenceEntry[],
): Map<string, ParsedSequenceEntry> {
  const registry = new Map<string, ParsedSequenceEntry>();

  for (const entry of sequenceEntries) {
    registry.set(entry.hexcode, entry);
    registry.set(toLookupHexcode(entry.hexcode), entry);
  }

  return registry;
}

function assignDeterministicSlugs(records: EmojiRecord[]): void {
  const slugOwners = new Map<string, string>();

  for (const record of records) {
    const baseSlug = toSlug(record.name);
    const existingOwner = slugOwners.get(baseSlug);

    if (!existingOwner) {
      record.slug = baseSlug;
      slugOwners.set(baseSlug, record.id);
      continue;
    }

    if (existingOwner === record.id) {
      record.slug = baseSlug;
      continue;
    }

    const disambiguatedSlug = `${baseSlug}-${record.hexcode.replace(/-/g, "").toLowerCase()}`;
    record.slug = disambiguatedSlug;
    slugOwners.set(disambiguatedSlug, record.id);
  }
}

function validateRecords(records: EmojiRecord[]): BuildValidationResult {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
  }

  return {
    duplicateIds: [...idCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id),
    duplicateSlugs: [...slugCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([slug]) => slug),
  };
}

function buildCategories(records: EmojiRecord[]): EmojiCategory[] {
  const categories = new Map<string, EmojiCategory>();

  for (const record of records) {
    if (!record.category) {
      continue;
    }

    const existing =
      categories.get(record.category) ??
      ({
        id: record.category,
        label: record.category.replace(/-/g, " "),
        subcategories: [],
      } satisfies EmojiCategory);

    if (
      record.subcategory &&
      !existing.subcategories.some((subcategory) => subcategory.id === record.subcategory)
    ) {
      existing.subcategories.push({
        id: record.subcategory,
        label: record.subcategory.replace(/-/g, " "),
      });
    }

    categories.set(record.category, existing);
  }

  return [...categories.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function createEmojiRecord(
  entry: ParsedEmojiTestEntry,
  sequenceRegistry: Map<string, ParsedSequenceEntry>,
): EmojiRecord {
  const metadata = lookupEmojibaseMetadata(entry.hexcode);
  const sequenceMatch =
    sequenceRegistry.get(entry.hexcode) ??
    sequenceRegistry.get(toLookupHexcode(entry.hexcode));
  const sequence = createSequenceInfoFromTest(entry);

  if (sequenceMatch) {
    sequence.unicodeSequenceType = sequenceMatch.sequenceType;
    sequence.sources = addSource(
      sequence.sources,
      sequenceMatch.sequenceType === "RGI_Emoji_ZWJ_Sequence"
        ? "emoji-zwj-sequences"
        : "emoji-sequences",
    );
  }

  const codePointsDecimal = entry.codePoints.map((codePoint) =>
    Number.parseInt(codePoint, 16),
  );

  return {
    id: entry.hexcode,
    emoji: entry.emoji,
    name: metadata?.label ?? entry.name,
    slug: "",
    category: metadata?.group ?? entry.category,
    subcategory: metadata?.subgroup ?? entry.subcategory,
    keywords: uniqueSorted(metadata?.tags ?? []),
    shortcodes: uniqueSorted(metadata?.shortcodes ?? []),
    unicodeVersion: entry.unicodeVersion,
    codePoints: entry.codePoints,
    codePointsDecimal,
    codePointString: toCodePointString(entry.codePoints),
    hexcode: entry.hexcode,
    sequence,
    order: metadata?.order,
    gender: metadata?.gender,
    skinTone: metadata?.skinTone,
  };
}

export function buildEmojiDataset(input: {
  emojiTestContent: string;
  emojiSequencesContent: string;
  emojiZwjSequencesContent: string;
}): EmojiDataset {
  const emojiTest = parseEmojiTest(input.emojiTestContent);
  const emojiSequences = parseEmojiSequences(input.emojiSequencesContent);
  const emojiZwjSequences = parseEmojiSequences(input.emojiZwjSequencesContent);

  const sequenceRegistry = buildSequenceRegistry([
    ...emojiSequences.entries,
    ...emojiZwjSequences.entries,
  ]);

  const websiteEntries = selectWebsiteEntries(emojiTest.entries);
  const records = websiteEntries
    .map((entry) => createEmojiRecord(entry, sequenceRegistry))
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.hexcode.localeCompare(right.hexcode);
    });

  assignDeterministicSlugs(records);

  const validation = validateRecords(records);
  if (validation.duplicateIds.length > 0 || validation.duplicateSlugs.length > 0) {
    throw new Error(
      `Emoji dataset validation failed. Duplicate IDs: ${validation.duplicateIds.join(", ") || "none"}. Duplicate slugs: ${validation.duplicateSlugs.join(", ") || "none"}.`,
    );
  }

  const categories = buildCategories(records);
  const sequenceKinds = records.reduce<Record<EmojiSequenceKind, number>>(
    (accumulator, record) => {
      accumulator[record.sequence.kind] =
        (accumulator[record.sequence.kind] ?? 0) + 1;
      return accumulator;
    },
    {
      single: 0,
      multi: 0,
      zwj: 0,
      "skin-tone": 0,
      gender: 0,
      flag: 0,
      keycap: 0,
    },
  );

  const manifest: EmojiDatasetManifest = {
    generatedAt: new Date().toISOString(),
    emojiVersion:
      emojiTest.version ??
      emojiSequences.version ??
      emojiZwjSequences.version ??
      "unknown",
    unicodeSource: "data/unicode-source",
    emojibaseVersion: getEmojibasePackageVersion(),
    recordCount: records.length,
    categoryCount: categories.length,
    validation,
    indexes: {
      bySlug: Object.fromEntries(records.map((record) => [record.slug, record.id])),
      byHexcode: Object.fromEntries(records.map((record) => [record.hexcode, record.id])),
    },
    categories,
    stats: {
      fullyQualified: records.length,
      withKeywords: records.filter((record) => record.keywords.length > 0).length,
      withShortcodes: records.filter((record) => record.shortcodes.length > 0).length,
      sequenceKinds,
    },
  };

  return {
    manifest,
    emojis: records,
  };
}
