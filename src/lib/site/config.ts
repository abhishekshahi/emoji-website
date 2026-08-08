/**
 * Central site configuration.
 * Set NEXT_PUBLIC_SITE_URL in production for canonical URLs, sitemap, and Open Graph.
 */

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

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "EmojiFind";

export const SITE_DESCRIPTION =
  "Search, copy, and discover emojis instantly. Browse categories, Unicode details, and OpenMoji artwork.";

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
