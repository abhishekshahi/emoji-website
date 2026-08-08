import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site/config";

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
}

export function createPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
  noIndex = false,
  image,
}: {
  title: string;
  description?: string;
  path: string;
  noIndex?: boolean;
  image?: string;
}): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    ...(noIndex
      ? {}
      : {
          alternates: {
            canonical: url,
          },
        }),
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: SITE_NAME,
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    },
  };
}

export function createEmojiPageMetadata({
  name,
  emoji,
  slug,
  keywords,
  codePointString,
  artworkPath,
}: {
  name: string;
  emoji: string;
  slug: string;
  keywords: string[];
  codePointString: string;
  artworkPath: string | null;
}): Metadata {
  const title = `${name} ${emoji} — Meaning, Copy & Unicode`;
  const keywordText = keywords.slice(0, 6).join(", ");
  const description = `Copy ${name} ${emoji}. Learn the meaning, Unicode details (${codePointString}), and related emojis.${keywordText ? ` Keywords: ${keywordText}.` : ""}`;

  return createPageMetadata({
    title,
    description,
    path: `/emoji/${slug}`,
    image: artworkPath ?? undefined,
  });
}

export function createCategoryPageMetadata({
  categoryLabel,
  categoryId,
  emojiCount,
}: {
  categoryLabel: string;
  categoryId: string;
  emojiCount: number;
}): Metadata {
  return createPageMetadata({
    title: `${categoryLabel} Emojis`,
    description: `Browse ${emojiCount.toLocaleString()} ${categoryLabel.toLowerCase()} emojis. Copy, search, and explore Unicode details.`,
    path: `/category/${categoryId}`,
  });
}
