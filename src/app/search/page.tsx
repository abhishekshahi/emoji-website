import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";

import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Search Emojis",
  description:
    "Search emojis by name, keyword, emoji character, or Unicode code point.",
  path: "/search",
});

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Search"
        title="Find any emoji"
        description="Search by name, keyword, emoji, U+ code point, or hexadecimal code. Results update as you type."
      />
      <SearchBar defaultValue={q} autoFocus mode="live" />
      <Suspense
        fallback={
          <div className="card-surface px-6 py-12 text-center text-muted">
            Loading search results...
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </div>
  );
}
