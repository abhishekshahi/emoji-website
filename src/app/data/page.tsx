import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import { buildPublicDataManifest } from "@/lib/master/public/data-manifest";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Data Downloads",
  description: "EmojiQuick master data exports, manifests, and checksums where licenses permit.",
  path: "/data",
  noIndex: true,
});

export default function DataDownloadsPage() {
  if (!isPublicMasterPlatformEnabled()) {
    notFound();
  }

  const manifest = buildPublicDataManifest();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Data"
        title="Master data downloads"
        description={`${manifest.version} — release ${manifest.releaseId}`}
      />

      <section className="card-surface grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-2xl font-bold">{manifest.totals.identities.toLocaleString()}</p>
          <p className="text-sm text-muted">Identities</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{manifest.totals.artworkRecords.toLocaleString()}</p>
          <p className="text-sm text-muted">Artwork records</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{manifest.totals.publicIdentities.toLocaleString()}</p>
          <p className="text-sm text-muted">Public identities</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{manifest.totals.indexableIdentities.toLocaleString()}</p>
          <p className="text-sm text-muted">Indexable</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Available downloads</h2>
        {manifest.downloads.map((download) => (
          <div key={download.id} className="card-surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{download.label}</p>
              <p className="text-sm text-muted">{download.description}</p>
              <p className="text-xs text-muted">License: {download.license}</p>
            </div>
            {download.available && download.path ? (
              <Link href={download.path} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                View
              </Link>
            ) : (
              <span className="text-sm text-muted">Coming in a future export phase</span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
