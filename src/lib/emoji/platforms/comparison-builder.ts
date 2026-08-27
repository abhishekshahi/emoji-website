import "server-only";
import { ARTWORK_PRIORITY_ORDER } from "@/lib/artwork/provider-architecture";
import type { ArtworkIdentityInput } from "@/lib/artwork/resolve-preferred-artwork";
import { hexcodeToCanonicalId } from "@/lib/content/analytics/validation";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { getArtwork } from "@/lib/master/integration/artwork/adapter";
import type { EmojiPlatformComparisonView, ProviderArtworkTile, SampleComparisonItem } from "./types";
import {
  getProviderLabel,
  resolveAllPublicProviderArtworks,
} from "./resolve-provider-artwork";

const VENDOR_NOTE =
  "Apple, Samsung, and WhatsApp use proprietary artwork on devices. EmojiQuick shows verified open-source reference artwork only — not live vendor screenshots.";

function identityFromHexcode(hexcode: string): ArtworkIdentityInput | null {
  const canonicalId = hexcodeToCanonicalId(hexcode);
  const lookup = getArtwork(canonicalId, { verifyChecksum: false });
  if (!lookup) return null;

  const artwork: ArtworkIdentityInput["artwork"] = {};
  for (const provider of ARTWORK_PRIORITY_ORDER) {
    const records = lookup.providers[provider];
    if (!records.length) continue;
    artwork[provider] = records.map((r) => ({
      sourceId: r.sourceId,
      path: r.localPath,
      format: r.format,
      variant: r.variant ?? null,
    }));
  }

  return { canonicalId, artwork };
}

function buildTiles(hexcode: string): ProviderArtworkTile[] {
  const identity = identityFromHexcode(hexcode);
  if (!identity) return [];
  const resolved = resolveAllPublicProviderArtworks(identity, hexcode);
  return resolved.map((r) => ({
    provider: r.provider,
    label: getProviderLabel(r.provider),
    url: r.url,
    license: r.license,
    publiclyServed: r.publiclyServed,
    note: "Open-source reference artwork served on EmojiQuick.",
  }));
}

export function buildEmojiPlatformComparisonView(
  emoji: BrowsableEmoji,
): EmojiPlatformComparisonView {
  return {
    unicodeGlyph: emoji.emoji,
    codePointString: emoji.codePointString,
    hexcode: emoji.hexcode,
    name: emoji.name,
    unicodeVersion: emoji.unicodeVersion,
    openSourceTiles: buildTiles(emoji.hexcode),
    vendorNote: VENDOR_NOTE,
  };
}

export function buildSampleComparisonItems(slugs: readonly string[]): SampleComparisonItem[] {
  const items: SampleComparisonItem[] = [];
  for (const slug of slugs) {
    const emoji = getBrowsableEmojiBySlug(slug);
    if (!emoji) continue;
    const comparison = buildEmojiPlatformComparisonView(emoji);
    if (comparison.openSourceTiles.length < 2) continue;
    items.push({ slug, label: emoji.name, comparison });
  }
  return items;
}
