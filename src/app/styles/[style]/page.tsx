import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleHubPage } from "@/components/hub/style-hub-page";
import { STYLE_PAGES } from "@/lib/hub/style-data";
import { STYLE_SLUGS, type StyleSlug } from "@/lib/hub/hub-routes";
import { createPageMetadata } from "@/lib/seo/metadata";

interface StylePageProps {
  params: Promise<{ style: string }>;
}

export function generateStaticParams() {
  return STYLE_SLUGS.map((style) => ({ style }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: StylePageProps): Promise<Metadata> {
  const { style } = await params;
  if (!STYLE_SLUGS.includes(style as StyleSlug)) {
    return { title: "Style not found" };
  }
  const page = STYLE_PAGES[style as StyleSlug];
  return createPageMetadata({
    title: page.title,
    description: page.description,
    path: `/styles/${style}`,
  });
}

export default async function StyleDetailPage({ params }: StylePageProps) {
  const { style } = await params;
  if (!STYLE_SLUGS.includes(style as StyleSlug)) {
    notFound();
  }
  return <StyleHubPage slug={style as StyleSlug} />;
}
