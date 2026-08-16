import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { TRENDING_PERIOD_SLUGS } from "@/lib/hub/hub-routes";
import { HUB_TRENDING_PERIOD_LINKS } from "@/lib/hub/hub-navigation";
import { getTrendingDiscovery } from "@/lib/discovery/engine";
import { createPageMetadata } from "@/lib/seo/metadata";
import type { DiscoveryPeriod } from "@/lib/discovery/types";

interface TrendingPeriodPageProps {
  params: Promise<{ period: string }>;
}

export function generateStaticParams() {
  return TRENDING_PERIOD_SLUGS.map((period) => ({ period }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: TrendingPeriodPageProps): Promise<Metadata> {
  const { period } = await params;
  if (!TRENDING_PERIOD_SLUGS.includes(period as DiscoveryPeriod)) {
    return { title: "Trending not found" };
  }
  const data = getTrendingDiscovery(period as DiscoveryPeriod);
  return createPageMetadata({
    title: `${data.label} — Trending Emojis`,
    description: `${data.label} emoji collection on EmojiQuick.`,
    path: `/trending/${period}`,
  });
}

export default async function TrendingPeriodPage({ params }: TrendingPeriodPageProps) {
  const { period } = await params;
  if (!TRENDING_PERIOD_SLUGS.includes(period as DiscoveryPeriod)) {
    notFound();
  }
  const data = getTrendingDiscovery(period as DiscoveryPeriod);
  return (
    <DiscoveryHubPage
      path={`/trending/${period}`}
      title={data.label}
      description={`${data.label} on EmojiQuick.`}
      eyebrow="Trending"
      kind="trending"
      period={period as DiscoveryPeriod}
      links={[
        { href: "/trending", label: "Trending hub" },
        ...HUB_TRENDING_PERIOD_LINKS.filter((l) => l.href !== `/trending/${period}`).map((l) => ({
          href: l.href,
          label: l.label,
        })),
        { href: "/popular", label: "Popular" },
        { href: "/explore", label: "Explore" },
      ]}
    />
  );
}
