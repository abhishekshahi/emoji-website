import type { MetadataRoute } from "next";
import { getAllBrowsableSlugs } from "@/lib/emoji/browsable-data";
import { getAllCategorySlugs, getManifest } from "@/lib/emoji/data";
import { getOpenMojiExtrasManifest } from "@/lib/emoji/extras-data";
import { getCanonicalEmojiSitemapSlugs } from "@/lib/master/integration/seo-migration/redirects";
import { absoluteUrl } from "@/lib/seo/metadata";

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
      url: absoluteUrl("/"),
      lastModified: generatedAt,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/emoji"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/extras"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/popular"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/new"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/search"),
      lastModified: generatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/licenses"),
      lastModified: generatedAt,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = getAllCategorySlugs().map(
    (category) => ({
      url: absoluteUrl(`/category/${category}`),
      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }),
  );

  const emojiPages: MetadataRoute.Sitemap = getCanonicalEmojiSitemapSlugs(getAllBrowsableSlugs()).map(
    (slug) => ({
      url: absoluteUrl(`/emoji/${slug}`),
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  return [...staticPages, ...categoryPages, ...emojiPages];
}
