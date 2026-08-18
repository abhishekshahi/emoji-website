import type { PlatformInfoRecord } from "./types";

const PLATFORMS: PlatformInfoRecord[] = [];

const now = new Date().toISOString();
const editorial = {
  source: "editorial" as const,
  author: "EmojiQuick Editorial",
  lastUpdated: now,
  qualityStatus: "partial" as const,
};

function bootstrap(): void {
  if (PLATFORMS.length > 0) return;

  PLATFORMS.push(
    {
      id: "platform-apple",
      name: "Apple",
      slug: "apple",
      description: "Apple Color Emoji ships with iOS, iPadOS, and macOS.",
      renderingNotes: "Apple designs its own emoji artwork; shapes and colors differ from Unicode reference glyphs.",
      differencesFromUnicode: "Platform-specific styling — not the Unicode standard itself.",
      availability: "iOS, iPadOS, macOS, watchOS",
      provenance: editorial,
    },
    {
      id: "platform-google",
      name: "Google",
      slug: "google",
      description: "Google Noto Color Emoji is used on Android and Chrome OS.",
      renderingNotes: "Noto is an open-source emoji set — EmojiQuick serves Noto artwork where licensed.",
      differencesFromUnicode: "Google maintains its own design language aligned with Unicode code points.",
      availability: "Android, Chrome OS, web via Noto",
      provenance: editorial,
    },
    {
      id: "platform-microsoft",
      name: "Microsoft",
      slug: "microsoft",
      description: "Fluent Emoji and legacy Segoe UI Emoji on Windows.",
      renderingNotes: "Microsoft Fluent Emoji offers 3D-style designs; EmojiQuick serves Fluent artwork where licensed.",
      differencesFromUnicode: "Platform artwork — Unicode defines characters, not visual appearance.",
      availability: "Windows, Microsoft 365",
      provenance: editorial,
    },
    {
      id: "platform-samsung",
      name: "Samsung",
      slug: "samsung",
      description: "Samsung One UI emoji set on Galaxy devices.",
      renderingNotes: "Samsung maintains distinct emoji designs for its Android skin.",
      differencesFromUnicode: "Visual style varies; code points remain Unicode-standard.",
      availability: "Samsung Galaxy devices",
      provenance: editorial,
    },
    {
      id: "platform-whatsapp",
      name: "WhatsApp",
      slug: "whatsapp",
      description: "WhatsApp uses its own emoji artwork within the messaging app.",
      renderingNotes: "In-app rendering may differ from the device's system emoji.",
      differencesFromUnicode: "App-specific artwork layer over Unicode characters.",
      availability: "WhatsApp mobile and web",
      provenance: editorial,
    },
    {
      id: "platform-x",
      name: "X (Twitter)",
      slug: "x",
      description: "X/Twitter uses Twemoji-derived artwork in the web client.",
      renderingNotes: "Twemoji is open-source — EmojiQuick serves Twemoji artwork where licensed.",
      differencesFromUnicode: "Twemoji designs differ from Apple/Google/Microsoft sets.",
      availability: "X web and supported clients",
      provenance: editorial,
    },
  );
}

bootstrap();

export function listPlatforms(): readonly PlatformInfoRecord[] {
  return PLATFORMS;
}

export function getPlatform(slug: string): PlatformInfoRecord | null {
  return PLATFORMS.find((p) => p.slug === slug) ?? null;
}
