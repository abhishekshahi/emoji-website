import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { HubTopicsNav } from "@/components/hub/hub-nav-sections";
import { HubLayout } from "@/components/hub/hub-layout";
import { HUB_TOPIC_LINKS } from "@/lib/hub/hub-navigation";
import { TOPIC_DEFINITIONS, getTopicEmojis } from "@/lib/hub/topic-data";
import type { TopicSlug } from "@/lib/hub/hub-routes";

interface TopicHubPageProps {
  topic: TopicSlug;
}

export function TopicHubPage({ topic }: TopicHubPageProps) {
  const def = TOPIC_DEFINITIONS[topic];
  const emojis = getTopicEmojis(topic);
  const path = `/topics/${topic}`;

  return (
    <HubLayout
      path={path}
      title={`${def.emoji} ${def.title}`}
      description={def.description}
      eyebrow="Topic collection"
      links={[
        { href: "/emoji", label: "All emojis" },
        { href: "/explore", label: "Explore" },
        ...HUB_TOPIC_LINKS.filter((t) => t.href !== path).map((t) => ({
          href: t.href,
          label: t.label,
        })),
      ]}
    >
      <p className="text-sm text-muted">
        {emojis.length.toLocaleString()} curated emojis · links to full detail pages with copy & Unicode info.
      </p>
      <EmojiGrid emojis={emojis} pageSize={48} />
      <HubTopicsNav />
      <p className="text-sm text-muted">
        Browse the full Unicode catalog on{" "}
        <Link href="/emoji" className="text-accent-strong underline">
          all emoji pages
        </Link>
        .
      </p>
    </HubLayout>
  );
}
