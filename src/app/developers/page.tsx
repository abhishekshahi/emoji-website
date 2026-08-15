import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Developer API",
  description: "EmojiQuick public master data API documentation for identities, metadata, search, and artwork.",
  path: "/developers",
  noIndex: true,
});

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/master/catalog",
    description: "Paginated master catalog. Params: filter, q, page, pageSize, sort, provider.",
  },
  {
    method: "GET",
    path: "/api/master/search?q=fire",
    description: "Search all 6,955 identities. Returns SEO pages and catalog items separately.",
  },
  {
    method: "GET",
    path: "/api/master/identity/{canonicalId}",
    description: "Full public identity with metadata, artwork providers, licenses, and provenance.",
  },
  {
    method: "GET",
    path: "/api/master/artwork/{canonicalId}",
    description: "Artwork availability, licenses, and public URLs per provider.",
  },
] as const;

export default function DevelopersPage() {
  if (!isPublicMasterPlatformEnabled()) {
    notFound();
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Developers"
        title="Public master data API"
        description="License-aware APIs for the complete EmojiQuick master catalog. Disabled in production until explicitly enabled."
      />

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <p className="text-muted">No authentication required for public read endpoints when the platform is enabled.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Endpoints</h2>
        {ENDPOINTS.map((endpoint) => (
          <div key={endpoint.path} className="card-surface space-y-2 p-4">
            <p className="font-mono text-sm">
              <span className="rounded bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong">
                {endpoint.method}
              </span>{" "}
              {endpoint.path}
            </p>
            <p className="text-sm text-muted">{endpoint.description}</p>
          </div>
        ))}
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">License &amp; attribution</h2>
        <p className="text-muted">
          All API responses include license and provenance metadata. See /licenses for provider terms.
          EmojiNet definitions are CC BY-NC-SA 4.0 — non-commercial use only.
        </p>
      </section>
    </div>
  );
}
