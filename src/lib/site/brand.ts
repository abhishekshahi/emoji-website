/** Official EmojiQuick brand assets — derived from emojiquick-logo-official-source.png (Phase 8.63). */

export const BRAND_LOGO_PRIMARY = "/brand/emojiquick-logo-primary.png";
export const BRAND_LOGO_PRIMARY_WEBP = "/brand/emojiquick-logo-primary.webp";
export const BRAND_ICON = "/brand/emojiquick-icon.png";
export const BRAND_WORDMARK = "/brand/emojiquick-wordmark.svg";
export const BRAND_OG_IMAGE = "/brand/emojiquick-og.png";
export const BRAND_OG_IMAGE_4K = "/brand/emojiquick-logo-primary-4k.png";

/** Primary logo intrinsic dimensions (official source aspect ratio). */
export const BRAND_LOGO_PRIMARY_WIDTH = 1024;
export const BRAND_LOGO_PRIMARY_HEIGHT = 558;

export const BRAND_FAVICON_16 = "/brand/favicon-16.png";
export const BRAND_FAVICON_32 = "/brand/favicon-32.png";
export const BRAND_FAVICON_48 = "/brand/favicon-48.png";
export const BRAND_FAVICON_96 = "/brand/favicon-96.png";
export const BRAND_FAVICON_180 = "/brand/favicon-180.png";
export const BRAND_FAVICON_192 = "/brand/favicon-192.png";
export const BRAND_FAVICON_256 = "/brand/favicon-256.png";
export const BRAND_FAVICON_512 = "/brand/favicon-512.png";

export const BRAND_FAVICONS = [
  { url: BRAND_FAVICON_16, sizes: "16x16", type: "image/png" },
  { url: BRAND_FAVICON_32, sizes: "32x32", type: "image/png" },
  { url: BRAND_FAVICON_48, sizes: "48x48", type: "image/png" },
  { url: BRAND_FAVICON_96, sizes: "96x96", type: "image/png" },
  { url: BRAND_FAVICON_180, sizes: "180x180", type: "image/png" },
  { url: BRAND_FAVICON_192, sizes: "192x192", type: "image/png" },
  { url: BRAND_FAVICON_256, sizes: "256x256", type: "image/png" },
  { url: BRAND_FAVICON_512, sizes: "512x512", type: "image/png" },
] as const;

export const BRAND_PWA_ICONS = [
  { src: BRAND_FAVICON_192, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: BRAND_FAVICON_512, sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: BRAND_FAVICON_512,
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;