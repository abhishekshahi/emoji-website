import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogFilters } from "@/components/public/catalog-filters";
import { CatalogGrid } from "@/components/public/catalog-grid";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import {
  getCatalogFilterCounts,
  getCatalogStats,
  queryCatalog,
} from "@/lib/master/public/catalog-service";
import type { CatalogFilterType } from "@/lib/master/public/catalog-service";
import { createPageMetadata } from "@/lib/seo/metadata";

interface CatalogPageProps {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}

export const metadata: Metadata = createPageMetadata({
  title: "Master Emoji Catalog",
  description:
    "Browse all 6,955 canonical emoji identities in the EmojiQuick master database — Unicode, source-specific, and private-use records with metadata and artwork availability.",
  path: "/catalog",
  noIndex: true,
});

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  if (!isPublicMasterPlatformEnabled()) {
    notFound();
  }

  const params = await searchParams;
  const filter = (params.filter ?? "all") as CatalogFilterType;
  const search = params.q ?? "";
  const page = Math.max(1, Number(params.page ?? "1"));
  const result = queryCatalog({ filter, search, page });
  const counts = getCatalogFilterCounts();
  const stats = getCatalogStats();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Master catalog"
        title="Complete emoji identity catalog"
        description={`Browse ${stats.publicIdentities.toLocaleString()} publicly discoverable identities from the EmojiQuick master database. ${stats.indexableIdentities.toLocaleString()} have indexable SEO pages.`}
      />

      <form className="flex gap-2" action="/catalog" method="get">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Filter by name, Unicode, or ID..."
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-2"
        />
        <button type="submit" className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-foreground">
          Search
        </button>
      </form>

      <CatalogFilters activeFilter={filter} counts={counts} search={search} />

      <p className="text-sm text-muted">
        Showing {result.items.length.toLocaleString()} of {result.total.toLocaleString()} identities
        {search ? ` matching "${search}"` : ""}
      </p>

      <CatalogGrid items={result.items} />

      {result.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-4" aria-label="Catalog pagination">
          {page > 1 ? (
            <Link
              href={`/catalog?${new URLSearchParams({ ...(filter !== "all" ? { filter } : {}), ...(search ? { q: search } : {}), page: String(page - 1) })}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            Page {page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link
              href={`/catalog?${new URLSearchParams({ ...(filter !== "all" ? { filter } : {}), ...(search ? { q: search } : {}), page: String(page + 1) })}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
