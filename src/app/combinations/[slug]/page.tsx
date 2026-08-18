import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPageTracker } from "@/components/analytics/content-analytics";
import { CopyButton } from "@/components/emoji/copy-button";
import { HubLayout } from "@/components/hub/hub-layout";
import { COMBINATION_SLUGS, getCombination } from "@/lib/content/combinations/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

interface CombinationPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COMBINATION_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: CombinationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const combo = getCombination(slug);
  if (!combo) return { title: "Combination not found" };
  return createPageMetadata({
    title: `${combo.sequence} ${combo.title}`,
    description: combo.meaning,
    path: `/combinations/${slug}`,
  });
}

export default async function CombinationPage({ params }: CombinationPageProps) {
  const { slug } = await params;
  const combo = getCombination(slug);
  if (!combo) notFound();

  const trackerCanonicalId = combo.emojiIds[0] ?? "unicode:1F525";

  return (
    <HubLayout
      path={`/combinations/${slug}`}
      title={combo.title}
      description={combo.meaning}
      eyebrow="Combination"
    >
      <ContentPageTracker kind="combination_view" canonicalId={trackerCanonicalId} slug={slug} />

      <section className="card-surface space-y-4 p-6 text-center">
        <p className="text-5xl" aria-label={`Combination: ${combo.sequence}`}>
          {combo.sequence}
        </p>
        <CopyButton label={combo.sequence} value={combo.sequence} variant="primary" size="lg" />
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Meaning</h2>
        <p className="text-muted">{combo.meaning}</p>
        {combo.usage ? <p className="text-sm text-muted">Usage: {combo.usage}</p> : null}
        {combo.contexts?.length ? (
          <p className="text-sm text-muted">Contexts: {combo.contexts.join(", ")}</p>
        ) : null}
      </section>

      <p className="text-sm">
        <Link href="/combinations" className="text-accent-strong underline">
          All combinations
        </Link>
      </p>
    </HubLayout>
  );
}
