import type { Metadata } from "next";
import {
  PRODUCTION_SITE_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site/config";

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function absoluteUrl(path: string): string {
  return new URL(normalizePath(path), SITE_URL).toString();
}

/** Production canonical base — always emojiquick.com regardless of deploy host. */
export function canonicalUrl(path: string): string {
  return new URL(normalizePath(path), PRODUCTION_SITE_URL).toString();
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
  const canonical = canonicalUrl(path);
  const url = absoluteUrl(path);

  return {
    title,
    description,
    ...(noIndex
      ? {}
      : {
          alternates: {
            canonical,
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
  meaningSnippet,
  categoryLabel,
}: {
  name: string;
  emoji: string;
  slug: string;
  keywords: string[];
  codePointString: string;
  artworkPath: string | null;
  meaningSnippet?: string;
  categoryLabel?: string;
}): Metadata {
  const title = `${emoji} ${name} Emoji — Meaning, Copy & Unicode`;
  const keywordText = keywords.slice(0, 6).join(", ");
  const trimmedMeaning =
    meaningSnippet && meaningSnippet.length > 120
      ? `${meaningSnippet.slice(0, 117)}...`
      : meaningSnippet;
  const description = trimmedMeaning
    ? `Copy ${name} ${emoji}. ${trimmedMeaning} Unicode ${codePointString}.${categoryLabel ? ` ${categoryLabel} emoji.` : ""}`
    : `Copy ${name} ${emoji}. Learn the meaning, Unicode details (${codePointString}), variants, and related emojis.${keywordText ? ` Keywords: ${keywordText}.` : ""}`;

  return createPageMetadata({
    title,
    description,
    path: `/emoji/${slug}`,
    image: artworkPath ?? undefined,
  });
}

export function createMasterIdentityPageMetadata({
  name,
  emoji,
  slug,
  keywords,
  codePointString,
  definition,
  artworkPath,
}: {
  name: string;
  emoji: string;
  slug: string;
  keywords: string[];
  codePointString: string;
  definition?: string;
  artworkPath?: string | null;
}): Metadata {
  const glyphPrefix = emoji ? `${emoji} ` : "";
  const title = `${glyphPrefix}${name} Emoji — Meaning, Copy & Unicode`;
  const keywordText = keywords.slice(0, 6).join(", ");
  const trimmedDefinition =
    definition && definition.length > 120 ? `${definition.slice(0, 117)}...` : definition;
  const unicodePart = codePointString ? ` Unicode ${codePointString}.` : "";
  const description = trimmedDefinition
    ? `Copy ${name}${emoji ? ` ${emoji}` : ""}. ${trimmedDefinition}${unicodePart}`
    : `Explore ${name}${emoji ? ` ${emoji}` : ""}. Learn meaning, Unicode details, artwork, and keywords.${unicodePart}${keywordText ? ` Keywords: ${keywordText}.` : ""}`;

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
  description,
}: {
  categoryLabel: string;
  categoryId: string;
  emojiCount: number;
  description?: string;
}): Metadata {
  return createPageMetadata({
    title: `${categoryLabel} Emojis`,
    description:
      description ??
      `Browse ${emojiCount.toLocaleString()} ${categoryLabel.toLowerCase()} emojis. Copy, search, and explore Unicode details.`,
    path: `/category/${categoryId}`,
  });
}
