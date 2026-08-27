import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  buildEventPagePath,
  getNearTermEvents,
  listEventGuides,
  type EventPageSlug,
} from "@/lib/kaomoji/events/registry";
import { getEventTimingDisplay } from "@/lib/kaomoji/events/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji Event Guides — Seasonal & Occasion Text Faces",
  description:
    "Copy kaomoji for holidays and life events: Christmas, Halloween, birthdays, weddings, graduation, and more. Stable evergreen URLs with helpful context.",
  path: "/kaomoji/events",
});

export default function KaomojiEventsIndexPage() {
  const guides = listEventGuides();
  const seasonal = guides.filter((g) => g.kind === "seasonal");
  const evergreen = guides.filter((g) => g.kind === "evergreen");
  const nearTerm = getNearTermEvents(new Date(), 6);

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Kaomoji Event Guides",
          url: "https://emojiquick.com/kaomoji/events",
          description: "Seasonal and evergreen kaomoji guides for holidays and life events.",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Events", path: "/kaomoji/events" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">Kaomoji event guides</h1>
        <p className="text-muted">
          Curated guides for holidays and everyday occasions. Each page explains when and how to use kaomoji,
          with copy-ready public text faces — not thin keyword pages or yearly URL duplicates.
        </p>
      </header>

      {nearTerm.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">In season now</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nearTerm.map((g) => {
              const timing = getEventTimingDisplay(g);
              return (
                <li key={g.slug} className="rounded-xl border border-border p-4 space-y-2">
                  <Link
                    href={buildEventPagePath(g.slug as EventPageSlug)}
                    className="text-lg font-semibold hover:underline"
                  >
                    {g.h1}
                  </Link>
                  <p className="text-sm text-muted">{g.description}</p>
                  {timing ? <p className="text-xs text-muted">{timing.detail}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Seasonal holidays</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seasonal.map((g) => (
            <li key={g.slug} className="rounded-xl border border-border p-4 space-y-2">
              <Link href={buildEventPagePath(g.slug as EventPageSlug)} className="text-lg font-semibold hover:underline">
                {g.h1}
              </Link>
              <p className="text-sm text-muted">{g.intro.slice(0, 140)}…</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Evergreen occasions</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evergreen.map((g) => (
            <li key={g.slug} className="rounded-xl border border-border p-4 space-y-2">
              <Link href={buildEventPagePath(g.slug as EventPageSlug)} className="text-lg font-semibold hover:underline">
                {g.h1}
              </Link>
              <p className="text-sm text-muted">{g.intro.slice(0, 140)}…</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/kaomoji" className="pill-link">
          Kaomoji hub
        </Link>
        <Link href="/kaomoji/collections" className="pill-link">
          Collections
        </Link>
        <Link href="/kaomoji/categories" className="pill-link">
          Categories
        </Link>
        <Link href="/kaomoji/search" className="pill-link">
          Search
        </Link>
      </div>
    </div>
  );
}
