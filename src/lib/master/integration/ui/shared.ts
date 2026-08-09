import type { BrowsableEmoji } from "@/lib/emoji/types";
import { isOpenMojiExtra } from "@/lib/emoji/types";
import type { UiProductionContext } from "./types";

export function toUiProductionContext(emoji: BrowsableEmoji): UiProductionContext {
  return Object.freeze({
    hexcode: emoji.hexcode,
    productionType: isOpenMojiExtra(emoji) ? "extra" : "standard",
    emoji: emoji.emoji,
    name: emoji.name,
    slug: emoji.slug,
  });
}

export function getFavoriteIdentityKey(context: UiProductionContext): string {
  return context.hexcode;
}

export function getRecentIdentityKey(context: UiProductionContext): string {
  return context.hexcode;
}

export function getCopyIdentityValue(context: UiProductionContext): string {
  return context.emoji;
}

export function getSharePath(context: UiProductionContext): string {
  return `/emoji/${context.slug}`;
}

export function resolveVariantPreference(
  variants: readonly string[],
  preferredVariant: string | null,
): string | null {
  if (variants.length === 0) {
    return null;
  }

  if (preferredVariant && variants.includes(preferredVariant)) {
    return preferredVariant;
  }

  const svg = variants.find((variant) => variant.toLowerCase() === "svg");
  if (svg) {
    return svg;
  }

  return variants[0] ?? null;
}
