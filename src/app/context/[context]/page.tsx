import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { CONTEXT_SLUGS } from "@/lib/hub/hub-routes";
import { HUB_CONTEXT_LINKS } from "@/lib/hub/hub-navigation";
import { getContextDiscovery } from "@/lib/discovery/engine";
import { createPageMetadata } from "@/lib/seo/metadata";
import type { DiscoveryContext } from "@/lib/discovery/types";

interface ContextPageProps {
  params: Promise<{ context: string }>;
}

export function generateStaticParams() {
  return CONTEXT_SLUGS.map((context) => ({ context }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: ContextPageProps): Promise<Metadata> {
  const { context } = await params;
  if (!CONTEXT_SLUGS.includes(context as DiscoveryContext)) {
    return { title: "Context not found" };
  }
  const data = getContextDiscovery(context as DiscoveryContext);
  return createPageMetadata({
    title: `${data.label} Emojis`,
    description: `Emojis for ${data.label} on EmojiQuick. Editorial baseline collection.`,
    path: `/context/${context}`,
  });
}

export default async function ContextPage({ params }: ContextPageProps) {
  const { context } = await params;
  if (!CONTEXT_SLUGS.includes(context as DiscoveryContext)) {
    notFound();
  }
  const data = getContextDiscovery(context as DiscoveryContext);
  return (
    <DiscoveryHubPage
      path={`/context/${context}`}
      title={`${data.label} Emojis`}
      description={`Emoji collection for ${data.label}.`}
      eyebrow="Context"
      kind="context"
      context={context as DiscoveryContext}
      links={[
        { href: "/explore", label: "Explore" },
        { href: "/popular", label: "Popular" },
        { href: "/trending", label: "Trending" },
        ...HUB_CONTEXT_LINKS.filter((l) => l.href !== `/context/${context}`).map((l) => ({
          href: l.href,
          label: l.label,
        })),
      ]}
    />
  );
}
