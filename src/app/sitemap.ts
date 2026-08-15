import type { MetadataRoute } from "next";
import { getAllCategorySlugs, getManifest } from "@/lib/emoji/data";
import { getOpenMojiExtrasManifest } from "@/lib/emoji/extras-data";
import { getActiveEmojiSitemapSlugs } from "@/lib/master/integration/seo-canary/active-migration";
import { getAllIdentitySlugs } from "@/lib/master/public/identity-slug-map";
import { canonicalUrl } from "@/lib/seo/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const manifest = getManifest();
  const extrasManifest = getOpenMojiExtrasManifest();
  const generatedAt = new Date(
    Math.max(
      new Date(manifest.generatedAt).getTime(),
      new Date(extrasManifest.generatedAt).getTime(),
    ),
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: canonicalUrl("/"),
      lastModified: generatedAt,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonicalUrl("/emoji"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: canonicalUrl("/extras"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: canonicalUrl("/popular"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: canonicalUrl("/new"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: canonicalUrl("/search"),
      lastModified: generatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: canonicalUrl("/licenses"),
      lastModified: generatedAt,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = getAllCategorySlugs().map(
    (category) => ({
      url: canonicalUrl(`/category/${category}`),
      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }),
  );

  const emojiPages: MetadataRoute.Sitemap = getActiveEmojiSitemapSlugs(getAllIdentitySlugs()).map(
    (slug) => ({
      url: canonicalUrl(`/emoji/${slug}`),
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  return [...staticPages, ...categoryPages, ...emojiPages];
}
