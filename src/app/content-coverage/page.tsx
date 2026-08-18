import type { Metadata } from "next";
import Link from "next/link";
import { ContentCoverageExplorer, type CoverageRecordRow } from "@/components/content/content-coverage-explorer";
import { HubLayout } from "@/components/hub/hub-layout";
import { computeKnowledgeCoverage } from "@/lib/content/knowledge/coverage";
import { listPublishedLocalizedPages } from "@/lib/content/localization/published-pages";
import { computeMultilingualCoverageReports, countEnglishLeakagePages } from "@/lib/content/localization/multilingual-coverage";
import { auditAllMeanings } from "@/lib/content/meaning/quality-audit";
import { computeContentPriorities } from "@/lib/content/meaning/priority-engine";
import { listMeanings } from "@/lib/content/meaning/registry";
import { listPublishedCollections } from "@/lib/content/collections/registry";
import { listPublishedCombinations } from "@/lib/content/combinations/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Content Coverage",
  description: "Honest editorial content coverage for EmojiQuick — rich, partial, and missing meaning counts.",
  path: "/content-coverage",
});

function buildCoverageRows(): CoverageRecordRow[] {
  const meanings = listMeanings();
  const meaningBySlug = new Map(meanings.map((m) => [m.slug, m]));
  const priorityBySlug = new Map(computeContentPriorities(500).map((p) => [p.slug, p.band]));
  const audits = auditAllMeanings();
  const richSlugs = new Set(
    meanings
      .filter(
        (m) =>
          m.meaning &&
          m.summary &&
          (m.examples?.length ?? 0) >= 1 &&
          m.provenance.qualityStatus === "complete",
      )
      .map((m) => m.slug),
  );
  const mediumSlugs = new Set(
    meanings
      .filter(
        (m) =>
          !richSlugs.has(m.slug) &&
          (m.contentTier === "medium" ||
            (m.provenance.qualityStatus === "partial" && m.summary && m.meaning)),
      )
      .map((m) => m.slug),
  );

  return audits
    .map((audit) => {
      const meaning = meaningBySlug.get(audit.slug);
      const tier = richSlugs.has(audit.slug)
        ? ("rich" as const)
        : mediumSlugs.has(audit.slug)
          ? ("medium" as const)
          : ("structured" as const);
      return {
        slug: audit.slug,
        tier,
        qualityScore: audit.score,
        priorityBand: priorityBySlug.get(audit.slug) ?? (meaning ? undefined : "P3"),
        issues: audit.issues,
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

export default function ContentCoveragePage() {
  const report = computeKnowledgeCoverage();
  const meanings = listMeanings();
  const lowQuality = auditAllMeanings().filter((r) => r.score < 70).slice(0, 8);
  const coverageRows = buildCoverageRows();
  const localizedByLang = listPublishedLocalizedPages().reduce<Record<string, number>>((acc, page) => {
    acc[page.language] = (acc[page.language] ?? 0) + 1;
    return acc;
  }, {});
  const multilingualReports = computeMultilingualCoverageReports();

  return (
    <HubLayout
      path="/content-coverage"
      title="Content Coverage"
      description="Transparent editorial coverage — EmojiQuick does not overclaim meaning content."
      eyebrow="Knowledge"
      links={[{ href: "/emoji-guide", label: "Emoji guide" }, { href: "/faq", label: "FAQ" }]}
    >
      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Coverage summary</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-muted">Canonical identities</dt><dd className="text-2xl font-semibold">{report.totalIdentities.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Indexable identities</dt><dd className="text-2xl font-semibold">{report.indexableIdentities.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Rich editorial (Tier 1)</dt><dd className="text-2xl font-semibold">{report.richContent.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Medium editorial (Tier 2)</dt><dd className="text-2xl font-semibold">{report.mediumContent.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Structured-only (Tier 3)</dt><dd className="text-2xl font-semibold">{report.structuredOnlyContent.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Missing editorial overlay</dt><dd className="text-2xl font-semibold">{report.missingContent.toLocaleString()}</dd></div>
          <div><dt className="text-sm text-muted">Collections</dt><dd className="text-2xl font-semibold">{listPublishedCollections().length}</dd></div>
          <div><dt className="text-sm text-muted">Combinations</dt><dd className="text-2xl font-semibold">{listPublishedCombinations().length}</dd></div>
          <div><dt className="text-sm text-muted">Editorial meanings registered</dt><dd className="text-2xl font-semibold">{meanings.length}</dd></div>
          <div><dt className="text-sm text-muted">Localized pages</dt><dd className="text-2xl font-semibold">{report.localizedPageCount}</dd></div>
          <div><dt className="text-sm text-muted">Tier 1 coverage</dt><dd className="text-2xl font-semibold">{report.richPercent}%</dd></div>
          <div><dt className="text-sm text-muted">Tier 2 coverage</dt><dd className="text-2xl font-semibold">{report.mediumPercent}%</dd></div>
          <div><dt className="text-sm text-muted">Avg quality score</dt><dd className="text-2xl font-semibold">{report.averageQualityScore}/100</dd></div>
          <div><dt className="text-sm text-muted">Weak records (&lt;70)</dt><dd className="text-2xl font-semibold">{report.weakRecordCount}</dd></div>
          <div><dt className="text-sm text-muted">Discovery rankings</dt><dd className="text-lg font-semibold">{report.analyticsRankingLabel}</dd></div>
        </dl>
        <p className="text-xs text-muted">Computed {new Date(report.computedAt).toLocaleString()} — Unicode official data exists for all indexable emojis; rich editorial is expanded incrementally.</p>
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Priority bands (top 500 scored)</h2>
        <dl className="grid gap-3 sm:grid-cols-4">
          <div><dt className="text-sm text-muted">P0</dt><dd className="text-xl font-semibold">{report.priorityBandCounts.P0}</dd></div>
          <div><dt className="text-sm text-muted">P1</dt><dd className="text-xl font-semibold">{report.priorityBandCounts.P1}</dd></div>
          <div><dt className="text-sm text-muted">P2</dt><dd className="text-xl font-semibold">{report.priorityBandCounts.P2}</dd></div>
          <div><dt className="text-sm text-muted">P3</dt><dd className="text-xl font-semibold">{report.priorityBandCounts.P3}</dd></div>
        </dl>
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Multilingual quality dashboard</h2>
        <p className="text-sm text-muted">English leakage pages: {countEnglishLeakagePages()}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="p-2">Language</th>
                <th className="p-2">Published</th>
                <th className="p-2">Coverage %</th>
                <th className="p-2">Quality</th>
                <th className="p-2">SEO ready</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {multilingualReports.map((row) => (
                <tr key={row.code} className="border-t border-border">
                  <td className="p-2">{row.nativeName}</td>
                  <td className="p-2">{row.publishedPages}</td>
                  <td className="p-2">{row.coveragePercent}%</td>
                  <td className="p-2">{row.qualityScore}/100</td>
                  <td className="p-2">{row.seoReadiness}%</td>
                  <td className="p-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Localized coverage</h2>
        <p className="text-sm text-muted">
          {Object.entries(localizedByLang)
            .map(([lang, count]) => `${lang}: ${count}`)
            .join(" · ")}
        </p>
      </section>

      <ContentCoverageExplorer records={coverageRows} />

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Priority opportunities</h2>
        <p className="text-sm text-muted">{report.priorityOpportunities.join(", ")}</p>
      </section>

      {lowQuality.length > 0 ? (
        <section className="card-surface space-y-3 p-6">
          <h2 className="text-xl font-semibold">Quality improvement candidates</h2>
          <ul className="text-sm text-muted">
            {lowQuality.map((item) => (
              <li key={item.slug}>{item.slug} — score {item.score} ({item.issues.join(", ")})</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Rich editorial slugs</h2>
        <p className="text-sm text-muted">{report.richSlugs.slice(0, 24).join(", ")}{report.richSlugs.length > 24 ? "…" : ""}</p>
        <Link href="/emoji/fire" className="text-sm text-accent-strong underline">View example: fire</Link>
      </section>
    </HubLayout>
  );
}
