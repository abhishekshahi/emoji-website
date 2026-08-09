import {
  getAllEmojis,
  getEmojiByHexcode,
  getEmojiById,
  getEmojiBySlug,
  getRelatedEmojis,
} from "./data";
import {
  getAllOpenMojiExtras,
  getOpenMojiExtraByHexcode,
  getOpenMojiExtraById,
  getOpenMojiExtraBySlug,
  getRelatedOpenMojiExtras,
} from "./extras-data";
import type { BrowsableEmoji } from "./types";
import { isOpenMojiExtra } from "./types";

export function getBrowsableEmojiBySlug(slug: string): BrowsableEmoji | undefined {
  return getEmojiBySlug(slug) ?? getOpenMojiExtraBySlug(slug);
}

export function getBrowsableEmojiByHexcode(
  hexcode: string,
): BrowsableEmoji | undefined {
  return getEmojiByHexcode(hexcode) ?? getOpenMojiExtraByHexcode(hexcode);
}

export function getBrowsableEmojiById(id: string): BrowsableEmoji | undefined {
  return getEmojiById(id) ?? getOpenMojiExtraById(id);
}

export function getRelatedBrowsableEmojis(
  emoji: BrowsableEmoji,
  limit = 8,
): BrowsableEmoji[] {
  if (isOpenMojiExtra(emoji)) {
    return getRelatedOpenMojiExtras(emoji, limit);
  }

  return getRelatedEmojis(emoji, limit);
}

export function getAllBrowsableEmojis(): BrowsableEmoji[] {
  return [...getAllEmojis(), ...getAllOpenMojiExtras()];
}

export function getAllBrowsableSlugs(): string[] {
  return getAllBrowsableEmojis().map((emoji) => emoji.slug);
}
