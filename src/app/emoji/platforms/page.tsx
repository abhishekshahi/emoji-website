import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  buildPlatformPagePath,
  listPlatformPageGuides,
  type PlatformPageSlug,
} from "@/lib/emoji/platforms/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Platform Guide — Unicode vs Platform Artwork",
  description:
    "Learn how emoji render on Apple, Google, Microsoft, Samsung, WhatsApp, and X. Compare verified open-source styles (Noto, Fluent, OpenMoji, Twemoji) on EmojiQuick.",
  path: "/emoji/platforms",
});

export default function EmojiPlatformsIndexPage() {
  const guides = listPlatformPageGuides();
  const vendor = guides.filter((g) => g.kind === "vendor");
  const guidesOnly = guides.filter((g) => g.kind === "guide" || g.kind === "open-source");

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Emoji Platform Guide",
          url: "https://emojiquick.com/emoji/platforms",
          description: "Platform notes and open-source emoji style comparison on EmojiQuick.",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Emoji", path: "/emoji" },
          { name: "Platforms", path: "/emoji/platforms" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">Emoji platforms &amp; styles</h1>
        <p className="text-muted">
          Unicode defines emoji characters — platforms apply their own artwork. EmojiQuick shows verified
          open-source reference artwork where licensed. We do not host Apple, Samsung, or WhatsApp proprietary
          artwork, and we do not claim live device screenshots.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Guides</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {guidesOnly.map((g) => (
            <li key={g.slug} className="rounded-xl border border-border p-4 space-y-2">
              <Link
                href={buildPlatformPagePath(g.slug as PlatformPageSlug)}
                className="text-lg font-semibold hover:underline"
              >
                {g.h1}
              </Link>
              <p className="text-sm text-muted">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Platform notes</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendor.map((g) => (
            <li key={g.slug} className="rounded-xl border border-border p-4 space-y-2">
              <Link
                href={buildPlatformPagePath(g.slug as PlatformPageSlug)}
                className="text-lg font-semibold hover:underline"
              >
                {g.h1}
              </Link>
              <p className="text-sm text-muted">{g.intro.slice(0, 140)}…</p>
              {g.hasVerifiedArtwork ? (
                <p className="text-xs text-muted">Open-source proxy artwork may be shown on emoji pages.</p>
              ) : (
                <p className="text-xs text-muted">Metadata only — no proprietary artwork hosted.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="prose max-w-3xl">
        <h2 className="text-xl font-semibold not-prose">Kaomoji distinction</h2>
        <p className="text-muted">
          Kaomoji are text compositions (for example <code>(^_^)</code>), not single emoji code points. Platform
          emoji artwork comparison mainly applies to Unicode emoji. See{" "}
          <Link href="/emoji/platforms/emoji-vs-kaomoji" className="underline">
            emoji vs kaomoji
          </Link>{" "}
          and the{" "}
          <Link href="/kaomoji" className="underline">
            kaomoji hub
          </Link>
          .
        </p>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/emoji" className="pill-link">
          Browse emoji
        </Link>
        <Link href="/styles/comparison" className="pill-link">
          Style architecture
        </Link>
        <Link href="/licenses" className="pill-link">
          Licenses
        </Link>
      </div>
    </div>
  );
}
