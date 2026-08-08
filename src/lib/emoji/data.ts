import emojis from "@/data/emojis.json";
import manifest from "@/data/manifest.json";
import {
  CATEGORY_LABELS,
  EMOJI_VERSION_ORDER,
  POPULAR_EMOJI_SLUGS,
} from "./constants";
import type { EmojiCategory, EmojiDatasetManifest, EmojiRecord } from "./types";

const emojiList = emojis as EmojiRecord[];
const emojiManifest = manifest as EmojiDatasetManifest;

const emojiById = new Map(emojiList.map((emoji) => [emoji.id, emoji]));
const emojiByHexcode = new Map(emojiList.map((emoji) => [emoji.hexcode, emoji]));
const emojiBySlug = new Map(emojiList.map((emoji) => [emoji.slug, emoji]));

export function getAllEmojis(): EmojiRecord[] {
  return emojiList;
}

export function getManifest(): EmojiDatasetManifest {
  return emojiManifest;
}

export function getCategories(): EmojiCategory[] {
  return emojiManifest.categories;
}

export function getEmojiById(id: string): EmojiRecord | undefined {
  return emojiById.get(id);
}

export function getEmojiBySlug(slug: string): EmojiRecord | undefined {
  return emojiBySlug.get(slug);
}

export function getEmojisByCategory(categoryId: string): EmojiRecord[] {
  return emojiList.filter((emoji) => emoji.category === categoryId);
}

export function getAllCategorySlugs(): string[] {
  return emojiManifest.categories.map((category) => category.id);
}

export function getCategoryLabel(categoryId: string): string {
  return CATEGORY_LABELS[categoryId] ?? formatLabel(categoryId);
}

export function getPopularEmojis(limit = POPULAR_EMOJI_SLUGS.length): EmojiRecord[] {
  return POPULAR_EMOJI_SLUGS.map((slug) => getEmojiBySlug(slug)).filter(
    (emoji): emoji is EmojiRecord => Boolean(emoji),
  ).slice(0, limit);
}

export function getNewEmojis(limit = 24): EmojiRecord[] {
  const versionRank = new Map(
    EMOJI_VERSION_ORDER.map((version, index) => [version, index]),
  );

  return [...emojiList]
    .sort((left, right) => {
      const leftRank =
        versionRank.get(left.unicodeVersion as (typeof EMOJI_VERSION_ORDER)[number]) ??
        Number.MAX_SAFE_INTEGER;
      const rightRank =
        versionRank.get(right.unicodeVersion as (typeof EMOJI_VERSION_ORDER)[number]) ??
        Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return (right.order ?? 0) - (left.order ?? 0);
    })
    .slice(0, limit);
}

export function getRelatedEmojis(emoji: EmojiRecord, limit = 8): EmojiRecord[] {
  const sameSubcategory = emojiList.filter(
    (candidate) =>
      candidate.id !== emoji.id &&
      candidate.subcategory === emoji.subcategory,
  );

  if (sameSubcategory.length >= limit) {
    return sameSubcategory.slice(0, limit);
  }

  const sameCategory = emojiList.filter(
    (candidate) =>
      candidate.id !== emoji.id &&
      candidate.category === emoji.category &&
      candidate.subcategory !== emoji.subcategory,
  );

  return [...sameSubcategory, ...sameCategory].slice(0, limit);
}

export function getEmojiByHexcode(hexcode: string): EmojiRecord | undefined {
  return emojiByHexcode.get(hexcode);
}

export function getEmojisByHexcodes(hexcodes: readonly string[]): EmojiRecord[] {
  return hexcodes
    .map((hexcode) => getEmojiByHexcode(hexcode))
    .filter((emoji): emoji is EmojiRecord => Boolean(emoji));
}

export function getEmojisByIds(ids: string[]): EmojiRecord[] {
  return ids
    .map((id) => getEmojiById(id))
    .filter((emoji): emoji is EmojiRecord => Boolean(emoji));
}

export function getAllEmojiSlugs(): string[] {
  return emojiList.map((emoji) => emoji.slug);
}

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
