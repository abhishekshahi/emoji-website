import type { MetadataRoute } from "next";
import {
  getAllCategorySlugs,
  getAllEmojiSlugs,
  getManifest,
} from "@/lib/emoji/data";
import { absoluteUrl } from "@/lib/seo/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const manifest = getManifest();
  const generatedAt = new Date(manifest.generatedAt);

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

  const emojiPages: MetadataRoute.Sitemap = getAllEmojiSlugs().map((slug) => ({
    url: absoluteUrl(`/emoji/${slug}`),
    lastModified: generatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...emojiPages];
}
