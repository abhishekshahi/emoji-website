/**
 * Production site URL — change before deploying to production.
 * Used for canonical URLs, sitemap, and Open Graph metadata.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://emojifind.example.com";

export const SITE_NAME = "EmojiFind";

export const SITE_DESCRIPTION =
  "Search, copy, and discover emojis instantly. Browse categories, Unicode details, and OpenMoji artwork.";

export const OPENMOJI_VERSION = "17.0.0";
export const OPENMOJI_LICENSE = "CC BY-SA 4.0";
export const OPENMOJI_PROJECT_URL = "https://openmoji.org/";
export const OPENMOJI_REPOSITORY_URL = "https://github.com/hfg-gmuend/openmoji";
export const OPENMOJI_LICENSE_URL =
  "https://creativecommons.org/licenses/by-sa/4.0/";
