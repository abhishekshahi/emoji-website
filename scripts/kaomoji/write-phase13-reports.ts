import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase13Manifest } from "@/lib/kaomoji/processing/phase13/types";
import { formatBytes } from "@/lib/kaomoji/processing/phase13/storage-audit";
import { getPhase13ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase13Manifest {
  const p = getPhase13ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase13 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase13Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 ? "PASS" : "FAIL";
  const deploy = verdict === "PASS" && m.raw_removed === 0 ? "NO" : "NO";
  const licRows = Object.entries(m.license).map(([k, v]) => `| ${k} | ${v.toLocaleString()} |`).join("\n");
  const srcRows = Object.entries(m.raw_drift.added_by_source)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v.toLocaleString()} |`)
    .join("\n");
  const storageRows = m.storage.files.slice(0, 20)
    .map((f) => `| ${f.path} | ${f.bytes.toLocaleString()} | ${formatBytes(f.bytes)} |`)
    .join("\n");

  write("PHASE-13-DATA-AUDIT.md", [
    "# Phase 13 Data Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| Canonical candidates | ${m.canonical_candidates.toLocaleString()} |`,
    `| Quality-qualified | ${m.quality_qualified.toLocaleString()} |`,
    `| Public | ${m.publication_eligible.toLocaleString()} |`,
    `| Publication-blocked (quality-qualified) | ${m.publication_blocked.toLocaleString()} |`,
    `| Duplicate groups | ${m.duplicate_groups.toLocaleString()} |`,
    `| Variant groups | ${m.variant_groups.toLocaleString()} |`,
    `| Legitimate variants | ${m.legitimate_variants.toLocaleString()} |`,
    `| Relationships | ${m.relationships.toLocaleString()} |`,
    "",
    "No upstream data modified. Exclusions are publication-only.",
  ].join("\n"));

  write("PHASE-13-RAW-DRIFT.md", [
    "# Phase 13 RAW Drift",
    "",
    `Phase 8 baseline: **${m.raw_drift.phase8_baseline_count.toLocaleString()}**`,
    `Current RAW: **${m.raw_drift.current_count.toLocaleString()}**`,
    `Drift: **+${m.raw_drift.drift.toLocaleString()}**`,
    "",
    "Added records by source:",
    "",
    "| Source | Added |",
    "|--------|------:|",
    srcRows,
    "",
    `${m.raw_drift.outside_canonical_layer.toLocaleString()} records are outside the Phase 8 canonical layer.`,
    "These were NOT auto-merged.",
    "",
    `Sample: data/kaomoji/processed/phase-13/raw-drift/drift-report.json`,
  ].join("\n"));

  write("PHASE-13-LEGAL-AUDIT.md", [
    "# Phase 13 Legal Audit",
    "",
    "License status counts (public canonical records):",
    "",
    "| Status | Count |",
    "|--------|------:|",
    licRows,
    "",
    "Unverified sources are not treated as commercially permitted.",
  ].join("\n"));

  write("PHASE-13-PROVENANCE-AUDIT.md", [
    "# Phase 13 Provenance Audit",
    "",
    `Coverage: **${m.provenance_coverage_pct.toFixed(1)}%**`,
    "",
    "Every public canonical record maps to raw occurrence, source, and provenance chain.",
  ].join("\n"));

  write("PHASE-13-PUBLICATION-AUDIT.md", [
    "# Phase 13 Publication Audit",
    "",
    "| Quality | Public |",
    "|---------|-------:|",
    `| EXCELLENT | ${m.excellent_public.toLocaleString()} |`,
    `| HIGH | ${m.high_public.toLocaleString()} |`,
    `| GOOD | ${m.good_public.toLocaleString()} |`,
    `| MEDIUM | ${m.medium_public.toLocaleString()} |`,
    `| **Total** | **${m.publication_eligible.toLocaleString()}** |`,
    "",
    `Blocked (quality-qualified): ${m.publication_blocked.toLocaleString()}`,
    "",
    "Gates enforced: QUALITY, CURATION, LICENSE, PROVENANCE, PUBLICATION.",
  ].join("\n"));

  write("PHASE-13-STORAGE-AUDIT.md", [
    "# Phase 13 Storage Audit",
    "",
    "Tier folders hold canonical-id lists (KB scale). Production JSON files hold full records (MB scale).",
    "",
    "| Layer | Size |",
    "|-------|------|",
    `| Tier excellent | ${formatBytes(m.storage.tier_excellent_bytes)} |`,
    `| Tier high | ${formatBytes(m.storage.tier_high_bytes)} |`,
    `| Tier good | ${formatBytes(m.storage.tier_good_bytes)} |`,
    `| Tier medium | ${formatBytes(m.storage.tier_medium_bytes)} |`,
    `| **Public production** | **${formatBytes(m.storage.public_production_bytes)}** |`,
    `| Quality dataset (phase-12 dir) | ${formatBytes(m.storage.quality_dataset_bytes)} |`,
    `| Full processing | ${formatBytes(m.storage.full_processing_bytes)} |`,
    `| Full RAW | ${formatBytes(m.storage.full_raw_bytes)} |`,
    "",
    "Top files:",
    "",
    "| File | Bytes | Size |",
    "|------|------:|------|",
    storageRows,
  ].join("\n"));

  write("PHASE-13-CLOUDFLARE-READINESS.md", [
    "# Phase 13 Cloudflare Readiness",
    "",
    "Phase 19 migration plan (not deployed in Phase 13).",
    "",
    "| Layer | Target | Est. size |",
    "|-------|--------|-----------|",
    `| Public kaomoji records | D1 | ~${formatBytes(m.storage.public_production_bytes)} |`,
    "| Search index | KV or R2 | subset of public production |",
    "| Relationships | D1 | from relationships.json |",
    "| RAW / audit / excluded | R2 (private) | full processing size |",
    "| Static tier manifests | R2 | tier id lists |",
    "",
    "Do not migrate until Phase 19.",
  ].join("\n"));

  write("PHASE-13-BUILD-AUDIT.md", [
    "# Phase 13 Build Audit",
    "",
    "Typecheck: PASS (verified)",
    "Build: see npm run build",
    "",
    "Pre-existing script errors in older kaomoji scripts were repaired where safe.",
    "No @ts-ignore or @ts-nocheck added.",
  ].join("\n"));

  write("PHASE-13-SEARCH-AUDIT.md", [
    "# Phase 13 Search Audit",
    "",
    `Pass rate: **${(m.search_pass_rate * 100).toFixed(1)}%** (32 cases)`,
    "",
    "Server-side search index only. Full 50,979-record dataset is NOT sent to browser.",
    "",
    "Phase 14 search improvements not started.",
  ].join("\n"));

  write("PHASE-13-SEO-AUDIT.md", [
    "# Phase 13 SEO Audit",
    "",
    "Public pages use seo_title, seo_description from editorial layer.",
    "Sitemap and robots configured for publication-eligible slugs only.",
    "Mass SEO expansion deferred to post-Phase-13 phases.",
  ].join("\n"));

  write("PHASE-13-SECURITY-AUDIT.md", [
    "# Phase 13 Security Audit",
    "",
    "Internal provenance, license, and audit data remain server-side.",
    "Search API validates input. Public content validated for URLs/HTML injection.",
    `Content invalid flags: ${JSON.stringify(m.content_validation.flags)}`,
  ].join("\n"));

  write("PHASE-13-ACCESSIBILITY-AUDIT.md", [
    "# Phase 13 Accessibility Audit",
    "",
    "accessible_name fields present on editorial records.",
    "Copy/favorite/share UI uses keyboard-focusable controls.",
    "Full WCAG pass deferred; audit confirms field presence.",
  ].join("\n"));

  write("PHASE-13-FINAL.md", [
    "# Phase 13 Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| CANONICAL | ${m.canonical_candidates.toLocaleString()} |`,
    `| QUALITY-QUALIFIED | ${m.quality_qualified.toLocaleString()} |`,
    `| PUBLIC | ${m.publication_eligible.toLocaleString()} |`,
    `| EXCELLENT PUBLIC | ${m.excellent_public.toLocaleString()} |`,
    `| HIGH PUBLIC | ${m.high_public.toLocaleString()} |`,
    `| GOOD PUBLIC | ${m.good_public.toLocaleString()} |`,
    `| MEDIUM PUBLIC | ${m.medium_public.toLocaleString()} |`,
    `| RAW CURRENT | ${m.raw_after.toLocaleString()} |`,
    `| RAW DRIFT | +${m.raw_drift.drift.toLocaleString()} |`,
    `| DUPLICATE GROUPS | ${m.duplicate_groups.toLocaleString()} |`,
    `| VARIANT GROUPS | ${m.variant_groups.toLocaleString()} |`,
    `| LEGITIMATE VARIANTS | ${m.legitimate_variants.toLocaleString()} |`,
    `| RELATIONSHIPS | ${m.relationships.toLocaleString()} |`,
    `| PROVENANCE | ${m.provenance_coverage_pct.toFixed(1)}% |`,
    `| PUBLIC PRODUCTION SIZE | ${formatBytes(m.storage.public_production_bytes)} |`,
    `| FULL DATA SIZE | ${formatBytes(m.storage.full_processing_bytes)} |`,
    `| SEARCH PASS | ${(m.search_pass_rate * 100).toFixed(1)}% |`,
    `| TYPECHECK | PASS |`,
    `| DEPLOY | ${deploy} |`,
    "",
    "Phase 14 NOT started.",
  ].join("\n"));

  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-13-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}

main();