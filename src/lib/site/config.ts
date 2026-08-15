/**
 * Central site configuration.
 * Set NEXT_PUBLIC_SITE_URL in production for canonical URLs, sitemap, and Open Graph.
 */

/** Public production hostname for canonicals, sitemap, robots, OG, Twitter, and JSON-LD. */
export const PRODUCTION_SITE_URL = "https://emojiquick.com" as const;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  return PRODUCTION_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "EmojiQuick";

export const SITE_DESCRIPTION =
  "Search, copy, and discover emojis instantly. Browse Unicode emoji meanings, names, keywords, variants, artwork, and code points on EmojiQuick.";

export const OPENMOJI_VERSION = "17.0.0";
export const OPENMOJI_LICENSE = "CC BY-SA 4.0";
export const OPENMOJI_PROJECT_URL = "https://openmoji.org/";
export const OPENMOJI_REPOSITORY_URL = "https://github.com/hfg-gmuend/openmoji";
export const OPENMOJI_LICENSE_URL =
  "https://creativecommons.org/licenses/by-sa/4.0/";

/** True when NEXT_PUBLIC_SITE_URL is explicitly configured. */
export const IS_SITE_URL_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SITE_URL?.trim(),
);
