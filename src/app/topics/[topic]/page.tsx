import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicHubPage } from "@/components/hub/topic-hub-page";
import { TOPIC_DEFINITIONS } from "@/lib/hub/topic-data";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/hub/hub-routes";
import { createPageMetadata } from "@/lib/seo/metadata";

interface TopicPageProps {
  params: Promise<{ topic: string }>;
}

export function generateStaticParams() {
  return TOPIC_SLUGS.map((topic) => ({ topic }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topic } = await params;
  if (!TOPIC_SLUGS.includes(topic as TopicSlug)) {
    return { title: "Topic not found" };
  }
  const def = TOPIC_DEFINITIONS[topic as TopicSlug];
  return createPageMetadata({
    title: def.title,
    description: def.description,
    path: `/topics/${topic}`,
  });
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topic } = await params;
  if (!TOPIC_SLUGS.includes(topic as TopicSlug)) {
    notFound();
  }
  return <TopicHubPage topic={topic as TopicSlug} />;
}
