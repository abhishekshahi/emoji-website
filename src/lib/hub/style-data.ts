import { getProviderArchitecture } from "@/lib/artwork/provider-architecture";
import { getEmojiBySlug } from "@/lib/emoji/data";
import type { EmojiRecord } from "@/lib/emoji/types";
import { canPublicServeArtworkProvider } from "@/lib/master/public/asset-rights";
import type { StyleSlug } from "./hub-routes";

const STYLE_SAMPLE_SLUGS: Record<StyleSlug, readonly string[]> = {
  noto: ["grinning-face", "red-heart", "fire", "thumbs-up", "sparkles"],
  fluent: ["grinning-face", "red-heart", "fire", "party-popper", "star-struck"],
  openmoji: ["grinning-face", "red-heart", "fire", "folded-hands", "rainbow"],
  twemoji: ["grinning-face", "red-heart", "fire", "ok-hand", "sunglasses"],
  default: ["grinning-face", "red-heart", "fire", "smiling-face-with-heart-eyes"],
  premium: ["star-struck", "party-popper", "fire", "red-heart"],
  artistic: ["rainbow", "sparkles", "artist-palette", "performing-arts"],
  classic: ["grinning-face", "red-heart", "fire", "thumbs-up"],
  comparison: ["grinning-face", "red-heart", "fire"],
};

export interface StylePageDefinition {
  readonly slug: StyleSlug;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly provider?: "noto" | "fluent" | "openmoji" | "twemoji";
  readonly role: string;
  readonly publicServing: boolean;
}

export const STYLE_PAGES: Record<StyleSlug, StylePageDefinition> = {
  noto: {
    slug: "noto",
    title: "Noto Emoji Style",
    tagline: "Default artwork priority",
    description:
      "Noto Emoji is the preferred default artwork source. Image/SVG resources are Apache-2.0; fonts are OFL 1.1 — both publicly served on EmojiQuick with required attribution.",
    provider: "noto",
    role: "Default",
    publicServing: canPublicServeArtworkProvider("noto"),
  },
  fluent: {
    slug: "fluent",
    title: "Fluent Emoji Style",
    tagline: "Premium / 3D artwork",
    description:
      "Microsoft Fluent Emoji provides a polished 3D look under the repository MIT license. Fluent artwork is publicly served on EmojiQuick with Microsoft attribution.",
    provider: "fluent",
    role: "Premium / 3D",
    publicServing: canPublicServeArtworkProvider("fluent"),
  },
  openmoji: {
    slug: "openmoji",
    title: "OpenMoji Style",
    tagline: "Artistic open-source artwork",
    description:
      "OpenMoji provides hand-drawn artistic emoji artwork under CC BY-SA 4.0. OpenMoji is publicly served on EmojiQuick with required attribution.",
    provider: "openmoji",
    role: "Artistic",
    publicServing: true,
  },
  twemoji: {
    slug: "twemoji",
    title: "Twemoji Style",
    tagline: "Classic flat artwork",
    description:
      "Twemoji offers the classic flat Twitter/X emoji style under CC BY 4.0. Twemoji is publicly served on EmojiQuick.",
    provider: "twemoji",
    role: "Classic",
    publicServing: true,
  },
  default: {
    slug: "default",
    title: "Default Emoji Style",
    tagline: "Noto-first resolver tier",
    description:
      "The default EmojiQuick artwork tier prefers Noto when available, then falls through Fluent, OpenMoji, and Twemoji based on availability and license policy.",
    provider: "noto",
    role: "Default",
    publicServing: canPublicServeArtworkProvider("noto"),
  },
  premium: {
    slug: "premium",
    title: "Premium Emoji Style",
    tagline: "Fluent 3D tier",
    description:
      "Premium tier maps to Fluent Emoji in the resolver priority stack — publicly served under MIT with Microsoft attribution.",
    provider: "fluent",
    role: "Premium / 3D",
    publicServing: canPublicServeArtworkProvider("fluent"),
  },
  artistic: {
    slug: "artistic",
    title: "Artistic Emoji Style",
    tagline: "OpenMoji hand-drawn look",
    description:
      "Artistic tier maps to OpenMoji — the primary publicly served artistic provider on EmojiQuick detail pages.",
    provider: "openmoji",
    role: "Artistic",
    publicServing: true,
  },
  classic: {
    slug: "classic",
    title: "Classic Emoji Style",
    tagline: "Twemoji flat design",
    description:
      "Classic tier maps to Twemoji — a widely recognized flat emoji style, publicly served under CC BY 4.0.",
    provider: "twemoji",
    role: "Classic",
    publicServing: true,
  },
  comparison: {
    slug: "comparison",
    title: "Emoji Style Comparison",
    tagline: "Compare artwork providers",
    description:
      "EmojiQuick resolves artwork in priority order: Noto → Fluent → OpenMoji → Twemoji. Public serving follows the verified asset rights registry for each provider.",
    role: "Comparison",
    publicServing: false,
  },
};

export function getStyleArchitectureTable() {
  return getProviderArchitecture();
}

/** Identity pages for style hub examples — links only, no private artwork exposure. */
export function getStyleSampleEmojis(slug: StyleSlug): EmojiRecord[] {
  const slugs = STYLE_SAMPLE_SLUGS[slug];
  return slugs
    .map((s) => getEmojiBySlug(s))
    .filter((emoji): emoji is EmojiRecord => Boolean(emoji));
}
