import extrasManifestData from "@/data/openmoji-extras-manifest.json";
import extras from "@/data/openmoji-extras.json";
import type {
  EmojiCategory,
  OpenMojiExtraRecord,
  OpenMojiExtrasManifest,
} from "./types";

const extraList = extras as OpenMojiExtraRecord[];
const extraManifest = extrasManifestData as OpenMojiExtrasManifest;

const extraById = new Map(extraList.map((extra) => [extra.id, extra]));
const extraByHexcode = new Map(extraList.map((extra) => [extra.hexcode, extra]));
const extraBySlug = new Map(extraList.map((extra) => [extra.slug, extra]));

export function getOpenMojiExtrasManifest(): OpenMojiExtrasManifest {
  return extraManifest;
}

export function getAllOpenMojiExtras(): OpenMojiExtraRecord[] {
  return extraList;
}

export function getOpenMojiExtraById(id: string): OpenMojiExtraRecord | undefined {
  return extraById.get(id);
}

export function getOpenMojiExtraBySlug(
  slug: string,
): OpenMojiExtraRecord | undefined {
  return extraBySlug.get(slug);
}

export function getOpenMojiExtraByHexcode(
  hexcode: string,
): OpenMojiExtraRecord | undefined {
  return extraByHexcode.get(hexcode);
}

export function getOpenMojiExtrasByCategory(
  categoryId: string,
): OpenMojiExtraRecord[] {
  return extraList.filter((extra) => extra.category === categoryId);
}

export function getAllOpenMojiExtraCategorySlugs(): string[] {
  return extraManifest.categories.map((category) => category.id);
}

export function getOpenMojiExtraCategories(): EmojiCategory[] {
  return extraManifest.categories;
}

export function getOpenMojiExtraCategoryLabel(categoryId: string): string {
  const category = extraManifest.categories.find((item) => item.id === categoryId);
  return category?.label ?? categoryId;
}

export function getOpenMojiExtraCategoryEmoji(categoryId: string): string {
  const subgroup = categoryId.replace(/^extra-/, "");
  return extraManifest.subgroupEmojis[subgroup] ?? "✨";
}

export function isOpenMojiExtraCategory(categoryId: string): boolean {
  return categoryId.startsWith("extra-");
}

export function getAllOpenMojiExtraSlugs(): string[] {
  return extraList.map((extra) => extra.slug);
}

export function getRelatedOpenMojiExtras(
  emoji: OpenMojiExtraRecord,
  limit = 8,
): OpenMojiExtraRecord[] {
  const sameCategory = extraList.filter(
    (candidate) =>
      candidate.id !== emoji.id && candidate.category === emoji.category,
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const sameGroup = extraList.filter(
    (candidate) =>
      candidate.id !== emoji.id &&
      candidate.openmojiGroup === emoji.openmojiGroup &&
      candidate.category !== emoji.category,
  );

  return [...sameCategory, ...sameGroup].slice(0, limit);
}
