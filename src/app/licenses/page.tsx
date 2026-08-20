import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createPageMetadata } from "@/lib/seo/metadata";
import { getAttributionBlocks, getRightsDashboardStats } from "@/lib/master/public/asset-rights";
import { LICENSE_REGISTRY } from "@/lib/master/public/license-registry";

export const metadata: Metadata = createPageMetadata({
  title: "Licenses & Attribution",
  description: "Third-party licenses, attribution, and asset rights for EmojiQuick.",
  path: "/licenses",
});

function SectionTable({ entries }: { entries: typeof LICENSE_REGISTRY }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-2 pr-4 font-semibold">Provider</th>
            <th className="py-2 pr-4 font-semibold">Asset type</th>
            <th className="py-2 pr-4 font-semibold">License</th>
            <th className="py-2 pr-4 font-semibold">Public serve</th>
            <th className="py-2 font-semibold">Download</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.provider}-${entry.assetType}`} className="border-b border-border/60">
              <td className="py-2 pr-4">{entry.provider}</td>
              <td className="py-2 pr-4 text-muted">{entry.assetType}</td>
              <td className="py-2 pr-4">
                <Link href={entry.licenseURL} className="text-accent-strong underline">{entry.license}</Link>
              </td>
              <td className="py-2 pr-4">{entry.publicServingAllowed ? "Yes" : "No"}</td>
              <td className="py-2">{entry.publicDownloadAllowed ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LicensesPage() {
  const stats = getRightsDashboardStats();
  const blocks = getAttributionBlocks();
  const artwork = blocks.filter((b) => b.category === "artwork");
  const unicode = blocks.filter((b) => b.category === "unicode");
  const metadata = blocks.filter((b) => b.category === "metadata" && b.provider !== "EmojiNet");
  const restricted = blocks.filter((b) => b.category === "restricted");

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Legal"
        title="Licenses & Attribution"
        description="Generated from the EmojiQuick asset rights registry. EmojiQuick is not affiliated with, endorsed by, or sponsored by the third-party projects listed below."
      />

      <section className="card-surface grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-2xl font-bold">{stats.totals.verified}</p><p className="text-sm text-muted">Verified entries</p></div>
        <div><p className="text-2xl font-bold">{stats.totals.publicServe}</p><p className="text-sm text-muted">Public serve allowed</p></div>
        <div><p className="text-2xl font-bold">{stats.totals.downloadable}</p><p className="text-sm text-muted">Download allowed</p></div>
        <div><p className="text-2xl font-bold">{stats.totals.restricted}</p><p className="text-sm text-muted">Restricted</p></div>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Artwork</h2>
        <p className="text-sm text-muted">OpenMoji, OpenMoji Extras, Twemoji, Noto, and Fluent artwork policies.</p>
        <SectionTable entries={LICENSE_REGISTRY.filter((e) => artwork.some((a) => a.provider === e.provider))} />
        {artwork.map((block) => (
          <p key={block.provider} className="text-xs text-muted">{block.attributionText}</p>
        ))}
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Unicode & character data</h2>
        <SectionTable entries={LICENSE_REGISTRY.filter((e) => unicode.some((u) => u.provider === e.provider))} />
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Metadata</h2>
        <SectionTable entries={LICENSE_REGISTRY.filter((e) => metadata.some((m) => m.provider === e.provider))} />
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Restricted sources</h2>
        <p className="text-sm text-muted">These sources are indexed privately and are not publicly served or downloaded on EmojiQuick.</p>
        <SectionTable entries={LICENSE_REGISTRY.filter((e) => restricted.some((r) => r.provider === e.provider))} />
      </section>

      <section className="card-surface space-y-2 p-6 text-sm text-muted">
        <p>EmojiQuick does not claim ownership of third-party emoji artwork or data.</p>
        <p>Public serving follows verification: only VERIFIED entries with explicit public-serve permission are distributed.</p>
      </section>
    </div>
  );
}
