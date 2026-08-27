import type { PlatformPageGuide } from "./types";

export const PLATFORM_PAGE_SLUGS = [
  "emoji-vs-kaomoji",
  "open-source-styles",
  "apple",
  "google",
  "microsoft",
  "samsung",
  "whatsapp",
  "x",
] as const;

export type PlatformPageSlug = (typeof PLATFORM_PAGE_SLUGS)[number];

const SLUG_SET = new Set<string>(PLATFORM_PAGE_SLUGS);

/** Sample emojis for open-source style comparison — high-traffic, multi-provider coverage. */
export const OPEN_SOURCE_SAMPLE_SLUGS = [
  "grinning-face",
  "red-heart",
  "fire",
  "thumbs-up",
  "folded-hands",
  "party-popper",
] as const;

const PAGES: Record<PlatformPageSlug, PlatformPageGuide> = {
  "emoji-vs-kaomoji": {
    slug: "emoji-vs-kaomoji",
    kind: "guide",
    title: "Emoji vs Kaomoji — Unicode Characters vs Text Faces",
    h1: "Emoji vs kaomoji",
    description:
      "Understand the difference between Unicode emoji (platform-rendered characters) and kaomoji (text compositions). Copy both on EmojiQuick.",
    intro:
      "Emoji are Unicode characters that devices and apps render with platform-specific artwork. Kaomoji are text compositions built from punctuation and letters — they look similar across apps because they are plain text, not proprietary emoji fonts.",
    renderingNotes:
      "Platform artwork comparison applies mainly to emoji. Kaomoji compatibility is about Unicode text support, not emoji font design.",
    artworkProxy: null,
    hasVerifiedArtwork: false,
    relatedSlugs: ["open-source-styles", "google", "apple"],
  },
  "open-source-styles": {
    slug: "open-source-styles",
    kind: "open-source",
    title: "Open-Source Emoji Styles — Noto, Fluent, OpenMoji & Twemoji",
    h1: "Open-source emoji styles",
    description:
      "Compare verified open-source emoji artwork on EmojiQuick: Noto, Fluent, OpenMoji, and Twemoji. Side-by-side samples with license attribution.",
    intro:
      "EmojiQuick serves open-source emoji artwork where license policy permits. These sets share Unicode code points but use different design languages. This page shows sample side-by-side renders — not live Apple or Samsung artwork.",
    renderingNotes:
      "Only publicly served artwork from Noto, Fluent, OpenMoji, and Twemoji is shown. Vendor platform artwork (Apple, Samsung, WhatsApp) is not hosted here.",
    artworkProxy: null,
    hasVerifiedArtwork: true,
    relatedSlugs: ["google", "microsoft", "x", "emoji-vs-kaomoji"],
  },
  apple: {
    slug: "apple",
    kind: "vendor",
    title: "Apple Emoji — Platform Notes & Unicode Reference",
    h1: "Apple emoji",
    description:
      "Apple Color Emoji on iOS, iPadOS, and macOS. Unicode reference and copy — Apple artwork is not hosted on EmojiQuick.",
    intro:
      "Apple designs its own emoji artwork for Apple platforms. The Unicode character is standard; the visual appearance on an iPhone or Mac depends on Apple Color Emoji.",
    renderingNotes:
      "EmojiQuick does not serve Apple Color Emoji artwork. Use the Unicode character on this site; appearance on Apple devices follows Apple's designs.",
    availability: "iOS, iPadOS, macOS, watchOS",
    artworkProxy: null,
    hasVerifiedArtwork: false,
    relatedSlugs: ["google", "samsung", "open-source-styles"],
  },
  google: {
    slug: "google",
    kind: "vendor",
    title: "Google Emoji — Noto Color Emoji Reference",
    h1: "Google emoji",
    description:
      "Google Noto Color Emoji on Android and Chrome OS. EmojiQuick serves Noto artwork where licensed — not a live device screenshot.",
    intro:
      "Google maintains Noto Color Emoji as an open-source set aligned to Unicode code points. EmojiQuick may display Noto artwork as a reference style — this is Noto artwork, not a guarantee of every Android device's rendering.",
    renderingNotes:
      "When Noto artwork is publicly served on an emoji page, it represents Google's open-source Noto design — not proprietary vendor screenshots.",
    availability: "Android, Chrome OS, web via Noto",
    artworkProxy: "noto",
    hasVerifiedArtwork: true,
    relatedSlugs: ["microsoft", "open-source-styles", "apple"],
  },
  microsoft: {
    slug: "microsoft",
    kind: "vendor",
    title: "Microsoft Emoji — Fluent Emoji Reference",
    h1: "Microsoft emoji",
    description:
      "Microsoft Fluent Emoji on Windows. EmojiQuick serves Fluent artwork where licensed — platform artwork may vary on device.",
    intro:
      "Microsoft Fluent Emoji provides 3D-style designs for Windows and Microsoft 365. EmojiQuick may display Fluent artwork under MIT license where publicly served.",
    renderingNotes:
      "Fluent artwork shown on EmojiQuick is open-source reference artwork — not a live Windows system screenshot.",
    availability: "Windows, Microsoft 365",
    artworkProxy: "fluent",
    hasVerifiedArtwork: true,
    relatedSlugs: ["google", "open-source-styles", "apple"],
  },
  samsung: {
    slug: "samsung",
    kind: "vendor",
    title: "Samsung Emoji — One UI Platform Notes",
    h1: "Samsung emoji",
    description:
      "Samsung One UI emoji on Galaxy devices. Unicode copy and platform notes — Samsung artwork is not hosted on EmojiQuick.",
    intro:
      "Samsung maintains distinct emoji designs for Galaxy devices. Unicode code points remain standard; visual style is Samsung-specific.",
    renderingNotes:
      "EmojiQuick does not serve Samsung One UI artwork. Platform artwork may vary on your Galaxy device.",
    availability: "Samsung Galaxy devices",
    artworkProxy: null,
    hasVerifiedArtwork: false,
    relatedSlugs: ["google", "apple", "whatsapp"],
  },
  whatsapp: {
    slug: "whatsapp",
    kind: "vendor",
    title: "WhatsApp Emoji — In-App Rendering Notes",
    h1: "WhatsApp emoji",
    description:
      "WhatsApp uses its own emoji artwork inside the app. Copy Unicode characters — in-app rendering may differ from system emoji.",
    intro:
      "WhatsApp may render emoji with its own artwork layer, which can differ from your phone's system emoji font.",
    renderingNotes:
      "EmojiQuick does not serve WhatsApp proprietary artwork. In-app rendering may vary.",
    availability: "WhatsApp mobile and web",
    artworkProxy: null,
    hasVerifiedArtwork: false,
    relatedSlugs: ["google", "apple", "x"],
  },
  x: {
    slug: "x",
    kind: "vendor",
    title: "X (Twitter) Emoji — Twemoji Reference",
    h1: "X (Twitter) emoji",
    description:
      "X/Twitter historically used Twemoji artwork. EmojiQuick serves Twemoji open-source artwork where licensed.",
    intro:
      "Twemoji is an open-source emoji set associated with X/Twitter's web client. EmojiQuick may display Twemoji artwork under CC BY 4.0 where publicly served.",
    renderingNotes:
      "Twemoji artwork on EmojiQuick is open-source reference artwork — not a live X client screenshot.",
    availability: "X web and supported clients",
    artworkProxy: "twemoji",
    hasVerifiedArtwork: true,
    relatedSlugs: ["open-source-styles", "google", "microsoft"],
  },
};

export function isPlatformPageSlug(slug: string): slug is PlatformPageSlug {
  return SLUG_SET.has(slug);
}

export function getPlatformPageGuide(slug: string): PlatformPageGuide | null {
  if (!isPlatformPageSlug(slug)) return null;
  return PAGES[slug];
}

export function listPlatformPageGuides(): readonly PlatformPageGuide[] {
  return PLATFORM_PAGE_SLUGS.map((s) => PAGES[s]);
}

export function buildPlatformPagePath(slug: PlatformPageSlug): string {
  return `/emoji/platforms/${slug}`;
}
