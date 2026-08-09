import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { PageHeader } from "@/components/layout/page-header";
import { getCategoryEmoji, getCategoryLabel, getRecordsByCategory } from "@/lib/emoji/data";
import { isOpenMojiExtraCategory } from "@/lib/emoji/extras-data";
import { createCategoryPageMetadata } from "@/lib/seo/metadata";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const { getAllCategorySlugs } = await import("@/lib/emoji/data");
  return getAllCategorySlugs().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const emojis = getRecordsByCategory(category);

  if (emojis.length === 0) {
    return { title: "Category not found" };
  }

  return createCategoryPageMetadata({
    categoryLabel: getCategoryLabel(category),
    categoryId: category,
    emojiCount: emojis.length,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const emojis = getRecordsByCategory(category);

  if (emojis.length === 0) {
    notFound();
  }

  const label = getCategoryLabel(category);

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Category"
        title={`${getCategoryEmoji(category)} ${label}`}
        description={`${emojis.length.toLocaleString()} ${isOpenMojiExtraCategory(category) ? "OpenMoji extras" : "emojis"} in this category.`}
      />

      <div className="flex flex-wrap gap-2">
        <Link href={isOpenMojiExtraCategory(category) ? "/extras" : "/emoji"} className="pill-link">
          {isOpenMojiExtraCategory(category) ? "All extras" : "Browse all"}
        </Link>
        <Link href="/search" className="pill-link">
          Search emojis
        </Link>
      </div>

      <EmojiGrid emojis={emojis} />
    </div>
  );
}
