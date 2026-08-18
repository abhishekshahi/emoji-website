import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoHubPage } from "@/lib/hub/info-pages";
import { INFO_PAGE_SLUGS, type InfoPageSlug } from "@/lib/hub/hub-routes";
import { getInfoPageContent } from "@/lib/hub/info-pages";
import { createPageMetadata } from "@/lib/seo/metadata";

interface InfoPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return INFO_PAGE_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: InfoPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!INFO_PAGE_SLUGS.includes(slug as InfoPageSlug)) {
    return { title: "Page not found" };
  }
  const content = getInfoPageContent(slug as InfoPageSlug);
  return createPageMetadata({
    title: content.title,
    description: content.description,
    path: `/${slug}`,
  });
}

export default async function InfoPage({ params }: InfoPageProps) {
  const { slug } = await params;
  if (!INFO_PAGE_SLUGS.includes(slug as InfoPageSlug)) {
    notFound();
  }
  return <InfoHubPage slug={slug as InfoPageSlug} />;
}
