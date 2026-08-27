import Link from "next/link";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import type { CategoryPageItem } from "@/lib/kaomoji/seo/category-loader";
import type { ReactNode } from "react";

export interface SeoHubLink {
  readonly href: string;
  readonly label: string;
}

export interface SeoFaqItem {
  readonly question: string;
  readonly answer: string;
}

interface KaomojiSeoHubPageProps {
  path: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  itemCount: number;
  items: readonly CategoryPageItem[];
  breadcrumbs: readonly { name: string; path: string }[];
  jsonLd: readonly Record<string, unknown>[];
  relatedIntents?: readonly SeoHubLink[];
  relatedCollections?: readonly SeoHubLink[];
  relatedMeanings?: readonly SeoHubLink[];
  relatedUseCases?: readonly SeoHubLink[];
  faq?: readonly SeoFaqItem[];
  extra?: ReactNode;
}

export function KaomojiSeoHubPage({
  path,
  title,
  h1,
  description,
  intro,
  itemCount,
  items,
  breadcrumbs,
  jsonLd,
  relatedIntents = [],
  relatedCollections = [],
  relatedMeanings = [],
  relatedUseCases = [],
  faq = [],
  extra,
}: KaomojiSeoHubPageProps) {
  return (
    <div className="page-shell space-y-8 pb-12">
      {jsonLd.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <Breadcrumbs items={[...breadcrumbs]} />
      <header className="space-y-3 max-w-3xl">
        <p className="text-sm text-muted uppercase tracking-wide">Kaomoji</p>
        <h1 className="text-3xl font-bold">{h1}</h1>
        <p className="text-muted">{description}</p>
        <p className="text-sm text-muted">{itemCount.toLocaleString()} public kaomoji</p>
      </header>
      <section className="prose max-w-3xl">
        <p>{intro}</p>
      </section>
      {extra}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Copy {title.toLowerCase()}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {items.map((item) => (
            <KaomojiCard
              key={item.canonical_id}
              item={{
                canonical_id: item.canonical_id,
                slug: item.slug,
                content: item.content,
                name: item.name,
                accessible_name: item.accessible_name,
              }}
            />
          ))}
        </div>
        {itemCount > items.length ? (
          <p className="text-sm text-muted">
            Showing top {items.length} of {itemCount.toLocaleString()}.{" "}
            <Link href={`/kaomoji/search?q=${encodeURIComponent(h1.replace(/ kaomoji$/i, ""))}`} className="underline">
              Search all
            </Link>
          </p>
        ) : null}
      </section>
      {(relatedIntents.length > 0 || relatedCollections.length > 0 || relatedMeanings.length > 0 || relatedUseCases.length > 0) && (
        <nav className="space-y-4 max-w-3xl" aria-label="Related kaomoji pages">
          {relatedIntents.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Related categories</h2>
              <ul className="flex flex-wrap gap-2">
                {relatedIntents.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="chip">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {relatedCollections.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">EmojiQuick collections</h2>
              <ul className="flex flex-wrap gap-2">
                {relatedCollections.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="chip">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {relatedMeanings.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Meanings</h2>
              <ul className="flex flex-wrap gap-2">
                {relatedMeanings.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="chip">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {relatedUseCases.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Use cases</h2>
              <ul className="flex flex-wrap gap-2">
                {relatedUseCases.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="chip">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>
      )}
      {faq.length > 0 ? (
        <section className="space-y-3 max-w-3xl">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <dl className="space-y-4">
            {faq.map((item) => (
              <div key={item.question}>
                <dt className="font-medium">{item.question}</dt>
                <dd className="text-muted mt-1">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/kaomoji" className="pill-link">
          Kaomoji hub
        </Link>
        <Link href="/kaomoji/categories" className="pill-link">
          All categories
        </Link>
        <Link href="/kaomoji/collections" className="pill-link">
          Collections
        </Link>
        <Link href="/kaomoji/search" className="pill-link">
          Search
        </Link>
      </div>
    </div>
  );
}
