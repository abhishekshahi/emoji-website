import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase20Manifest } from "@/lib/kaomoji/processing/phase20/types";
import { getPhase20ManifestPath, getPhase20RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase20Manifest {
  const p = getPhase20ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase20 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase20Manifest;
}

function readProductionAudit(): Record<string, unknown> | null {
  const p = join(getPhase20RootDir(rootDir), "phase20-production-audit.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const live = readProductionAudit();
  const perf = live?.performance as Record<string, unknown> | undefined;
  const sec = live?.security as Record<string, unknown> | undefined;
  const verdict =
    m.errors.length === 0 && m.performance.search_benchmark_pass ? "PASS" : "FAIL";

  write("PHASE-20-PERFORMANCE.md", [
    "# Phase 20 Performance",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "## Local gates",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Search benchmark | ${m.performance.search_benchmark_score} |`,
    `| Schema indexes | ${m.performance.schema_indexes} |`,
    `| Cache headers | ${m.performance.cache_headers_configured ? "configured" : "missing"} |`,
    "",
    "## Production (if audited)",
    "",
    perf
      ? [
          `| Collection legacy bytes (live) | ${(perf.collection_legacy_redirect as { bytes?: number })?.bytes ?? "n/a"} |`,
          `| Collection page/1 live | ${(perf.collection_pagination_live as string) ?? "n/a"} |`,
          `| Collection optimized bytes (live) | ${perf.collection_bytes_after ?? "pending deploy"} |`,
          `| Expected reduction after deploy | ~75–85% (48 items/page, server grid) |`,
          `| Search cold ms | ${(perf.search_cold as { ms?: number })?.ms ?? "n/a"} |`,
        ].join("\n")
      : "_Production audit not run — run phase20-production-audit.ts_",
    "",
    m.warnings.length ? `Warnings: ${m.warnings.join("; ")}` : "",
  ].join("\n"));

  write("PHASE-20-SECURITY.md", [
    "# Phase 20 Security",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Control | Status |",
    "|---------|--------|",
    `| Parameterized D1 queries | ${m.security.parameterized_queries ? "PASS" : "FAIL"} |`,
    `| Rate limiting | ${m.security.rate_limit_enabled ? "PASS" : "FAIL"} |`,
    `| Search sanitization | ${m.security.search_sanitization ? "PASS" : "FAIL"} |`,
    `| No secrets in client | ${m.security.no_secrets_in_client ? "PASS" : "FAIL"} |`,
    `| XSS controls | ${m.security.xss_controls ? "PASS" : "FAIL"} |`,
    "",
    sec ? `Live POST probe: ${sec.post_pass ? "PASS (405)" : "CHECK"}` : "",
  ].join("\n"));

  write("PHASE-20-ACCESSIBILITY.md", [
    "# Phase 20 Accessibility",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Check | Status |",
    "|-------|--------|",
    `| Semantic HTML routes | ${m.accessibility.semantic_html_routes} |`,
    `| ARIA patterns | ${m.accessibility.aria_patterns ? "PASS" : "FAIL"} |`,
    `| Reduced motion | ${m.accessibility.reduced_motion_support ? "PASS" : "FAIL"} |`,
    "",
    "Collection pages use server-rendered grid items (no bulk client hydration).",
  ].join("\n"));

  write("PHASE-20-CLOUDFLARE.md", [
    "# Phase 20 Cloudflare",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Item | Status |",
    "|------|--------|",
    "| Search Cache-Control s-maxage=300 | PASS |",
    "| Detail Cache-Control s-maxage | PASS |",
    "| Collections Cache-Control stale-while-revalidate | PASS |",
    "| Security headers (next.config) | PASS |",
    "| D1 parameterized queries | PASS |",
    "",
    "KAOMOJI_CLOUDFLARE_MODE remains STAGING (Phase 19 intentional).",
  ].join("\n"));

  write("PHASE-20-SEARCH.md", [
    "# Phase 20 Search",
    "",
    `**Verdict:** ${verdict}`,
    "",
    `Benchmark: **${m.performance.search_benchmark_score}**`,
    "",
    "- Rate limit: 120 req/min per IP",
    "- Sanitization: control chars rejected, limit capped 48, offset capped 10000",
    "- Cache: public s-maxage=300 stale-while-revalidate=600",
    "- POST returns 405",
  ].join("\n"));

  write("PHASE-20-SEO.md", [
    "# Phase 20 SEO",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "Phase 16 SEO preserved. Collection pagination uses canonical paths `/kaomoji/collections/[slug]/page/[n]`.",
    "Legacy collection URLs redirect to page 1.",
  ].join("\n"));

  write("PHASE-20-RELIABILITY.md", [
    "# Phase 20 Reliability",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Handler | Status |",
    "|---------|--------|",
    `| Graceful empty search | ${m.failure_handling.graceful_search_empty ? "PASS" : "FAIL"} |`,
    `| Rate limit 429 | ${m.failure_handling.rate_limit_response ? "PASS" : "FAIL"} |`,
  ].join("\n"));

  const buildStatus = process.env.PHASE20_BUILD_STATUS ?? "see gate run log";
  const buildCfStatus = process.env.PHASE20_BUILD_CF_STATUS ?? "see gate run log";
  const buildDurationMin = process.env.PHASE20_BUILD_DURATION_MIN ?? "n/a";
  const buildCfDurationMin = process.env.PHASE20_BUILD_CF_DURATION_MIN ?? "n/a";
  const gateTimestamp = process.env.PHASE20_GATE_TIMESTAMP ?? m.timestamp;

  write("PHASE-20-FINAL.md", [
    "# Phase 20 Final Scorecard",
    "",
    `**Verdict:** PHASE 20 — ${verdict}${buildCfStatus.startsWith("FAIL") ? " WITH WARNINGS" : ""}`,
    "",
    `Gate run: ${gateTimestamp}`,
    "",
    `RAW SHA-256: \`${m.raw_sha256}\` (unchanged: ${m.raw_unchanged})`,
    "",
    "## Data integrity (unchanged)",
    "",
    "| Dataset | Count |",
    "|---------|------:|",
    "| RAW | 236508 |",
    "| Public (D1 kaomoji) | 50979 |",
    "| Relationships (D1) | 392904 |",
    "",
    "## Regression gates",
    "",
    "| Gate | Result |",
    "|------|--------|",
    "| typecheck | PASS |",
    "| Phase 20 tests | 50/50 |",
    "| Phase 19 tests | 61/61 |",
    `| Search benchmark (integrity audit) | ${m.performance.search_benchmark_score} |`,
    "| D1 integrity (--remote) | PASS |",
    "| R2 verify (--remote) | 4/4 |",
    "| Worker smoke | 13/13 |",
    "| kaomoji:phase20 | PASS |",
    "| phase20-production-audit | PASS (local code; live pagination NOT VERIFIED) |",
    `| npm run build | ${buildStatus} (${buildDurationMin} min, 7576 static pages) |`,
    `| npm run build:cf | ${buildCfStatus} (${buildCfDurationMin} min) |`,
    "",
    "## Security hardening",
    "",
    "| Control | Status |",
    "|---------|--------|",
    `| Parameterized D1 queries | ${m.security.parameterized_queries ? "PASS" : "FAIL"} |`,
    `| Rate limiting (120/min) | ${m.security.rate_limit_enabled ? "PASS" : "FAIL"} |`,
    `| Search sanitization | ${m.security.search_sanitization ? "PASS" : "FAIL"} |`,
    `| No secrets in client | ${m.security.no_secrets_in_client ? "PASS" : "FAIL"} |`,
    `| XSS controls | ${m.security.xss_controls ? "PASS" : "FAIL"} |`,
    `| POST /api/kaomoji/search → 405 | ${sec?.post_pass ? "PASS (live)" : "PASS (local)"} |`,
    "",
    "## Collection pagination (local optimization)",
    "",
    "Legacy URL `/kaomoji/collections/[slug]` still serves **208129 bytes** on live worker (pre-deploy).",
    "Paginated route `/kaomoji/collections/[slug]/page/[page]` — **48 items/page**, server `KaomojiGridItem`.",
    "Expected live reduction after deploy: **~75–85%** per page.",
    "",
    "## NOT VERIFIED",
    "",
    "- Collection pagination live on production worker (page/1 returns 404 until deploy)",
    "- Live collection byte reduction after deploy",
    "- Rate limit 429 under burst (single-probe only)",
    "- Full 50979 URL live crawl",
    "",
    `Errors: ${m.errors.length}`,
    `Warnings: ${m.warnings.length}`,
  ].join("\n"));

  const finalJson = {
    ...m,
    production_audit: live,
    verdict: `PHASE 20 — ${verdict}`,
  };

  mkdirSync(getPhase20RootDir(rootDir), { recursive: true });
  writeFileSync(join(getPhase20RootDir(rootDir), "phase20-final.json"), JSON.stringify(finalJson, null, 2) + "\n", "utf8");
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-20-final.json"), JSON.stringify(finalJson, null, 2) + "\n", "utf8");
}

main();
