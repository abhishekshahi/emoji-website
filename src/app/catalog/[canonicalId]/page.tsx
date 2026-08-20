import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { IdentityTypeBadge } from "@/components/public/identity-type-badge";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import { getCatalogItem } from "@/lib/master/public/catalog-service";
import { buildPublicIdentityResponse } from "@/lib/master/public/identity-service";
import { getIdentityTypeDescription } from "@/lib/master/public/visibility";
import { createPageMetadata } from "@/lib/seo/metadata";

interface CatalogIdentityPageProps {
  params: Promise<{ canonicalId: string }>;
}

export async function generateMetadata({ params }: CatalogIdentityPageProps): Promise<Metadata> {
  const { canonicalId: encoded } = await params;
  const canonicalId = decodeURIComponent(encoded);
  const identity = buildPublicIdentityResponse(canonicalId);
  if (!identity) {
    return { title: "Identity not found" };
  }
  return createPageMetadata({
    title: `${identity.officialName} — Master Catalog`,
    description: `Master catalog entry for ${identity.officialName}. ${getIdentityTypeDescription(identity.identityType as "unicode" | "source-specific" | "private-use")}`,
    path: identity.catalogUrl,
    noIndex: !identity.visibility.indexable,
  });
}

export default async function CatalogIdentityPage({ params }: CatalogIdentityPageProps) {
  if (!isPublicMasterPlatformEnabled()) {
    notFound();
  }

  const { canonicalId: encoded } = await params;
  const canonicalId = decodeURIComponent(encoded);
  const summary = getCatalogItem(canonicalId);
  const identity = buildPublicIdentityResponse(canonicalId);

  if (!summary || !identity) {
    notFound();
  }

  return (
    <div className="page-shell space-y-8">
      <Breadcrumbs
        items={[
          { name: "Catalog", path: "/catalog" },
          { name: identity.officialName, path: identity.catalogUrl },
        ]}
      />

      <div className="space-y-3">
        {identity.glyph ? <p className="text-5xl">{identity.glyph}</p> : null}
        <PageHeader
          eyebrow="Master identity"
          title={identity.officialName}
          description={getIdentityTypeDescription(identity.identityType as "unicode" | "source-specific" | "private-use")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <IdentityTypeBadge identityType={summary.identityType} label={identity.identityTypeLabel} />
        {identity.seoPageUrl ? (
          <Link href={identity.seoPageUrl} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong">
            View SEO page →
          </Link>
        ) : (
          <span className="rounded-full bg-surface-muted px-3 py-1 text-sm text-muted">Catalog only — not indexable</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Identity</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-semibold text-muted">Canonical ID</dt>
              <dd className="font-mono">{identity.canonicalId}</dd>
            </div>
            {identity.unicodeSequence ? (
              <div>
                <dt className="font-semibold text-muted">Unicode</dt>
                <dd className="font-mono">U+{identity.unicodeSequence.replace(/-/g, " U+")}</dd>
              </div>
            ) : null}
            {identity.category ? (
              <div>
                <dt className="font-semibold text-muted">Category</dt>
                <dd>{identity.category}{identity.subcategory ? ` / ${identity.subcategory}` : ""}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">Artwork providers</h2>
          {identity.artworkProviders.length === 0 ? (
            <p className="text-muted">No artwork indexed for this identity.</p>
          ) : (
            <ul className="space-y-3">
              {identity.artworkProviders.map((provider) => (
                <li key={provider.provider} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{provider.label}</span>
                    <span className={`text-xs font-semibold ${provider.status === "public" ? "text-emerald-600" : "text-amber-600"}`}>
                      {provider.status === "public" ? "Public" : "Restricted"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{provider.license}</p>
                  {provider.message ? <p className="mt-2 text-sm text-muted">{provider.message}</p> : null}
                  {provider.artworkUrl ? (
                    <Link href={provider.artworkUrl} className="mt-2 inline-block text-sm text-accent-strong underline">
                      View artwork
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {identity.keywords.length > 0 ? (
        <section className="card-surface space-y-3 p-6">
          <h2 className="text-xl font-semibold">Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {identity.keywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-surface-muted px-3 py-1 text-sm">{keyword}</span>
            ))}
          </div>
        </section>
      ) : null}

      {identity.definitions.length > 0 ? (
        <section className="card-surface space-y-3 p-6">
          <h2 className="text-xl font-semibold">Definitions</h2>
          {identity.definitions.map((definition, index) => (
            <p key={index} className="text-muted">{definition}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
