import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import { getArtworkProviderPolicy } from "@/lib/master/public/license-registry";
import { MASTER_ARTWORK_RECORD_COUNT } from "@/lib/master/r2/catalog";
import { createPageMetadata } from "@/lib/seo/metadata";
import { ARTWORK_PROVIDERS } from "@/lib/master/integration/artwork/types";
import { PROVIDER_LABELS } from "@/lib/master/integration/ui/attribution";

export const metadata: Metadata = createPageMetadata({
  title: "Artwork Catalog",
  description: `Browse ${MASTER_ARTWORK_RECORD_COUNT.toLocaleString()} artwork records across OpenMoji, Noto, Twemoji, and Fluent with license and attribution information.`,
  path: "/artwork",
  noIndex: true,
});

export default function ArtworkCatalogPage() {
  if (!isPublicMasterPlatformEnabled()) {
    notFound();
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Artwork"
        title="Master artwork catalog"
        description={`${MASTER_ARTWORK_RECORD_COUNT.toLocaleString()} artwork records indexed across four providers. Public serving depends on license verification.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {ARTWORK_PROVIDERS.map((provider) => {
          const policy = getArtworkProviderPolicy(provider);
          return (
            <section key={provider} className="card-surface space-y-3 p-6">
              <h2 className="text-xl font-semibold">{PROVIDER_LABELS[provider]}</h2>
              <p className="text-sm text-muted">
                Status:{" "}
                <strong className={policy.publicServingAllowed ? "text-emerald-600" : "text-amber-600"}>
                  {policy.publicServingAllowed ? "Public serving allowed" : "Private until verified"}
                </strong>
              </p>
              <p className="text-sm text-muted">
                Download: {policy.publicDownloadAllowed ? "Permitted with attribution" : "Not available publicly"}
              </p>
              <Link href="/licenses" className="text-sm text-accent-strong underline">
                View license details →
              </Link>
            </section>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        Use the <Link href="/catalog" className="text-accent-strong underline">master catalog</Link> to browse identities and view per-identity artwork availability.
      </p>
    </div>
  );
}
