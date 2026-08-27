import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KaomojiSeoHubPage } from "@/components/kaomoji/kaomoji-seo-hub-page";
import { getCategoryPageData } from "@/lib/kaomoji/seo/category-loader-server";
import {
  buildIntentPageDescription,
  buildIntentPageTitle,
  isCuratedIntentSlug,
  MIN_INTENT_PAGE_RECORDS,
  resolveIntentTaxonomy,
} from "@/lib/kaomoji/seo/intent-registry";
import {
  getMeaningPageContent,
  MEANING_PAGE_SLUGS,
} from "@/lib/kaomoji/seo/meaning-pages";
import { buildKaomojiDefinedTermJsonLd, buildKaomojiIntentBreadcrumbJsonLd } from "@/lib/kaomoji/seo/structured-data";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return MEANING_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = getMeaningPageContent(slug);
  if (!content) return { title: "Meaning Not Found" };
  return createPageMetadata({
    title: content.title,
    description: content.description,
    path: `/kaomoji/meaning/${slug}`,
  });
}

export default async function KaomojiMeaningPage({ params }: Props) {
  const { slug } = await params;
  const content = getMeaningPageContent(slug);
  if (!content || !isCuratedIntentSlug(content.intentSlug)) notFound();

  const category = resolveIntentTaxonomy(content.intentSlug);
  if (!category) notFound();

  const data = await getCategoryPageData(content.intentSlug, 24);
  if (!data || data.itemCount < MIN_INTENT_PAGE_RECORDS) notFound();

  const path = `/kaomoji/meaning/${slug}`;

  return (
    <KaomojiSeoHubPage
      path={path}
      title={content.title}
      h1={content.h1}
      description={content.description}
      intro={`${content.intro} ${content.usage}`}
      itemCount={data.itemCount}
      items={data.items}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Kaomoji", path: "/kaomoji" },
        { name: `${category.label} kaomoji`, path: `/kaomoji/${content.intentSlug}` },
        { name: content.h1, path },
      ]}
      jsonLd={[
        buildKaomojiDefinedTermJsonLd(content.h1, content.intro, path),
        buildKaomojiIntentBreadcrumbJsonLd(category.label, content.intentSlug),
      ]}
      relatedIntents={[{ href: `/kaomoji/${content.intentSlug}`, label: `Copy ${category.label} kaomoji` }]}
      relatedMeanings={[]}
    />
  );
}
