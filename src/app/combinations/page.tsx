import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { listPublishedCombinations } from "@/lib/content/combinations/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Combinations",
  description: "Curated emoji combinations with meanings and one-click copy on EmojiQuick.",
  path: "/combinations",
});

export default function CombinationsIndexPage() {
  const combinations = listPublishedCombinations();

  return (
    <HubLayout
      path="/combinations"
      title="Emoji Combinations"
      description="Curated emoji sequences with editorial meanings. Copy entire combinations with one click."
      eyebrow="Combinations"
      links={[{ href: "/emoji-guide", label: "Emoji guide" }, { href: "/combinations/generator", label: "Generator" }]}
    >
      <p className="text-sm text-muted">
        These are curated editorial combinations — not exhaustive permutations. Individual emoji identities remain unchanged.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {combinations.map((combo) => (
          <Link
            key={combo.slug}
            href={`/combinations/${combo.slug}`}
            className="card-surface flex flex-col gap-2 p-6 transition hover:border-accent"
          >
            <span className="text-3xl" aria-hidden="true">
              {combo.sequence}
            </span>
            <span className="font-semibold">{combo.title}</span>
            <span className="text-sm text-muted">{combo.meaning}</span>
          </Link>
        ))}
      </div>
    </HubLayout>
  );
}
