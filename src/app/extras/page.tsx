import type { Metadata } from "next";
import Link from "next/link";
import { ExtrasCategoryGrid } from "@/components/category/extras-category-grid";
import { PageHeader } from "@/components/layout/page-header";
import { getOpenMojiExtrasManifest } from "@/lib/emoji/extras-data";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
} from "@/lib/site/config";

export const metadata: Metadata = createPageMetadata({
  title: "OpenMoji Extras",
  description:
    "Browse OpenMoji Extras — additional symbols, brands, and designs beyond the standard Unicode emoji set.",
  path: "/extras",
});

export default function ExtrasPage() {
  const manifest = getOpenMojiExtrasManifest();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="OpenMoji"
        title="OpenMoji Extras"
        description={`Explore ${manifest.recordCount.toLocaleString()} additional OpenMoji designs across ${manifest.categoryCount} categories, separate from the standard Unicode emoji collection.`}
      />

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-lg font-semibold">About OpenMoji Extras</h2>
        <p className="text-muted">
          OpenMoji Extras include community-designed symbols and Unicode characters
          outside the standard emoji set. Artwork is provided by{" "}
          <Link href={OPENMOJI_PROJECT_URL} className="text-accent-strong underline">
            OpenMoji
          </Link>{" "}
          under{" "}
          <Link href={OPENMOJI_LICENSE_URL} className="text-accent-strong underline">
            {OPENMOJI_LICENSE}
          </Link>
          . Individual designs credit their authors on each detail page.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span className="rounded-full bg-surface-muted px-3 py-1">
            OpenMoji symbols: {manifest.openmojiGroupCounts["extras-openmoji"].toLocaleString()}
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1">
            Unicode extras: {manifest.openmojiGroupCounts["extras-unicode"].toLocaleString()}
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="section-title">Extra Categories</h2>
          <p className="section-subtitle">
            Browse OpenMoji Extras by topic, separate from standard Unicode categories.
          </p>
        </div>
        <ExtrasCategoryGrid />
      </section>
    </div>
  );
}
