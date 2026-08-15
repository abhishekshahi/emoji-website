import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { IdentityTypeBadge } from "@/components/public/identity-type-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { getIdentityTypeDescription } from "@/lib/master/public/visibility";
import type { PublicIdentityResponse } from "@/lib/master/public/types";
import { absoluteUrl } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/site/config";

interface MasterIdentityDetailPageProps {
  slug: string;
  identity: PublicIdentityResponse;
}

function formatCodePoints(sequence: string | null): string | null {
  if (!sequence) return null;
  return sequence.split("-").map((part) => `U+${part}`).join(" ");
}

export function MasterIdentityDetailPage({ slug, identity }: MasterIdentityDetailPageProps) {
  const pageUrl = absoluteUrl(`/emoji/${slug}`);
  const codePoints = formatCodePoints(identity.unicodeSequence ?? identity.hexcode);
  const identityType = identity.identityType as "unicode" | "source-specific" | "private-use";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: identity.officialName,
    description: identity.definitions[0] ?? `Explore ${identity.officialName} emoji meaning, Unicode details, and artwork.`,
    url: pageUrl,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: SITE_NAME, url: absoluteUrl("/") },
    ...(identity.glyph ? { alternateName: identity.glyph } : {}),
    ...(codePoints ? { termCode: codePoints } : {}),
  };

  return (
    <div className="page-shell space-y-10 pb-12">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Emoji", path: "/emoji" }, { name: identity.officialName, path: `/emoji/${slug}` }]} />
      <div className="space-y-4">
        {identity.glyph ? <p className="text-6xl">{identity.glyph}</p> : null}
        <PageHeader eyebrow="Emoji identity" title={identity.officialName} description={identity.definitions[0] ?? getIdentityTypeDescription(identityType)} />
        <div className="flex flex-wrap gap-2">
          <IdentityTypeBadge identityType={identityType} label={identity.identityTypeLabel} />
          {identity.catalogUrl ? <Link href={identity.catalogUrl} className="rounded-full bg-surface-muted px-3 py-1 text-sm text-muted underline">Master catalog entry</Link> : null}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Details</h2>
          <dl className="grid gap-3 text-sm">
            {codePoints ? <div><dt className="font-semibold text-muted">Unicode</dt><dd className="font-mono">{codePoints}</dd></div> : null}
            <div><dt className="font-semibold text-muted">Canonical ID</dt><dd className="font-mono break-all">{identity.canonicalId}</dd></div>
          </dl>
        </section>
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Artwork</h2>
          {identity.artworkProviders.length === 0 ? <p className="text-muted">No publicly served artwork for this identity yet.</p> : (
            <ul className="space-y-3">
              {identity.artworkProviders.map((provider) => (
                <li key={provider.provider} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{provider.label}</span><span className="text-xs font-semibold">{provider.status === "public" ? "Public" : "Restricted"}</span></div>
                  {provider.artworkUrl ? <Link href={provider.artworkUrl} className="mt-2 inline-block text-sm text-accent-strong underline">View artwork</Link> : null}
                  {provider.message ? <p className="mt-2 text-sm text-muted">{provider.message}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {identity.keywords.length > 0 ? (
        <section className="card-surface space-y-3 p-6"><h2 className="text-xl font-semibold">Keywords</h2><div className="flex flex-wrap gap-2">{identity.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-surface-muted px-3 py-1 text-sm">{keyword}</span>)}</div></section>
      ) : null}
      <section className="card-surface space-y-3 p-6 text-sm text-muted">
        <h2 className="text-base font-semibold text-foreground">Copy and use</h2>
        <p>{identity.glyph ? `Copy ${identity.glyph} (${identity.officialName}) to use in messages and posts.` : `Browse metadata and artwork for ${identity.officialName}.`}</p>
        <p>Artwork and metadata are sourced from the EmojiQuick master archive. See <Link href="/licenses" className="text-accent-strong underline">licenses</Link> for attribution details.</p>
      </section>
    </div>
  );
}