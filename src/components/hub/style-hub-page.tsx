import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { HubStylesNav } from "@/components/hub/hub-nav-sections";
import { HubLayout } from "@/components/hub/hub-layout";
import { STYLE_PAGES, getStyleArchitectureTable, getStyleSampleEmojis } from "@/lib/hub/style-data";
import { STYLE_SLUGS, type StyleSlug } from "@/lib/hub/hub-routes";

interface StyleHubPageProps {
  slug?: StyleSlug;
}

export function StyleHubPage({ slug }: StyleHubPageProps) {
  if (!slug) {
    return (
      <HubLayout
        path="/styles"
        title="Emoji Artwork Styles"
        description="Learn how EmojiQuick resolves emoji artwork across Noto, Fluent, OpenMoji, and Twemoji with license-aware fallback."
        eyebrow="Artwork"
        links={STYLE_SLUGS.filter((s) => s !== "comparison").map((s) => ({
          href: `/styles/${s}`,
          label: STYLE_PAGES[s].title,
        }))}
      >
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Resolver priority</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted">
            <li>Noto — Default (indexed, license-gated)</li>
            <li>Fluent — Premium / 3D (indexed, license-gated)</li>
            <li>OpenMoji — Artistic (public CC BY-SA 4.0)</li>
            <li>Twemoji — Classic (public CC BY 4.0)</li>
          </ol>
          <p className="text-sm text-muted">
            Missing preferred artwork does not remove an emoji identity page.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {STYLE_SLUGS.map((s) => (
            <Link key={s} href={`/styles/${s}`} className="card-surface block p-5 hover:border-accent">
              <h3 className="font-semibold">{STYLE_PAGES[s].title}</h3>
              <p className="mt-1 text-sm text-muted">{STYLE_PAGES[s].tagline}</p>
            </Link>
          ))}
        </section>
        <HubStylesNav />
      </HubLayout>
    );
  }

  const page = STYLE_PAGES[slug];
  const path = `/styles/${slug}`;
  const sampleEmojis = getStyleSampleEmojis(slug);

  return (
    <HubLayout
      path={path}
      title={page.title}
      description={page.description}
      eyebrow={`Style · ${page.role}`}
      links={[
        { href: "/styles", label: "All styles" },
        { href: "/styles/comparison", label: "Compare styles" },
        { href: "/explore", label: "Explore" },
        { href: "/licenses", label: "Licenses" },
      ]}
    >
      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Serving policy</h2>
        <p className="text-muted">
          Public serving:{" "}
          <strong>{page.publicServing ? "Allowed on EmojiQuick" : "Indexed only — not publicly served"}</strong>
        </p>
        {page.provider ? (
          <p className="text-sm text-muted">
            Provider key: <code className="rounded bg-surface-muted px-1">{page.provider}</code>
          </p>
        ) : null}
      </section>
      {slug === "comparison" ? (
        <section className="card-surface overflow-x-auto p-6">
          <h2 className="mb-4 text-xl font-semibold">Provider architecture</h2>
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Public</th>
                <th className="py-2">License</th>
              </tr>
            </thead>
            <tbody>
              {getStyleArchitectureTable().map((row) => (
                <tr key={row.provider} className="border-b border-border/60">
                  <td className="py-2 pr-4">{row.priorityRank}</td>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4">{row.publiclyServed ? "Yes" : "Indexed only"}</td>
                  <td className="py-2">{row.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Featured emoji identities</h2>
          <p className="text-sm text-muted">
            Example Unicode identities — open any page to copy the glyph and view license-aware artwork.
          </p>
          <EmojiGrid emojis={sampleEmojis} pageSize={sampleEmojis.length} />
        </section>
      )}
      <HubStylesNav compact />
    </HubLayout>
  );
}
