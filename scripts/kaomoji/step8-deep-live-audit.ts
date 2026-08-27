/**
 * Step 8 — deep live website audit (trending / popular rankings).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";
import type { KaomojiRankingResult } from "@/lib/kaomoji/rankings/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";
const RANKING_PAGES = ["/kaomoji", "/kaomoji/popular", "/kaomoji/trending"] as const;
const FABRICATED_PATTERNS = [
  /\b\d{1,3}(,\d{3})+\s+views\b/i,
  /\bview count\b/i,
  /\bcopy count\b/i,
  /\b\d{1,3}(,\d{3})+\s+copies\b/i,
];

async function fetchHtml(path: string): Promise<{ status: number; html: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text(), ms: Date.now() - t0 };
}

async function fetchJson<T>(path: string): Promise<{ status: number; data: T; ms: number; text: string }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  const ms = Date.now() - t0;
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) as T, ms, text };
  } catch {
    return { status: res.status, data: {} as T, ms, text };
  }
}

function auditRankingResult(
  label: string,
  result: KaomojiRankingResult,
  add: (severity: Severity, area: string, message: string) => void,
): number {
  if (result.items.length === 0) return 0;

  const ids = result.items.map((i) => i.canonical_id);
  const slugs = result.items.map((i) => i.slug);
  const contents = result.items.map((i) => i.content);

  if (new Set(ids).size !== ids.length) add("HIGH", "duplicate", `${label} duplicate canonical ids`);
  if (new Set(slugs).size !== slugs.length) add("HIGH", "duplicate", `${label} duplicate slugs`);
  if (new Set(contents).size !== contents.length) add("MEDIUM", "duplicate", `${label} duplicate content`);

  if (result.status === "INSUFFICIENT_DATA" && result.label.toLowerCase().includes("trending") && !result.label.includes("Featured")) {
    add("LOW", "label", `${label} trending label without live data`);
  }

  for (const item of result.items) {
    if (!/^kao_[a-f0-9]{16}$/.test(item.canonical_id)) {
      add("HIGH", "integrity", `${label} invalid canonical id ${item.canonical_id}`);
    }
  }

  return result.items.length;
}

export async function runStep8LiveAudit(auditLabel: string): Promise<{
  pass: boolean;
  findings: Finding[];
  build_id: string;
  git_sha: string;
  api_performance_ms: Record<string, number>;
  quality_audit: { records_checked: number; blocked_leaks: number };
}> {
  const findings: Finding[] = [];
  let fid = 0;
  const add = (severity: Severity, area: string, message: string) => {
    findings.push({ id: `${auditLabel}-F${++fid}`, severity, area, message });
  };

  let buildId = "unknown";
  let gitSha = "unknown";
  try {
    buildId = (await fetch(`${CUSTOM}/BUILD_ID`, { cache: "no-store" }).then((r) => r.text())).trim();
  } catch {
    add("HIGH", "deployment", "Could not fetch BUILD_ID");
  }
  try {
    gitSha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    add("INFO", "deployment", "Could not read local git SHA");
  }

  let recordsChecked = 0;
  let blockedLeaks = 0;
  const apiTimes: Record<string, number> = {};

  for (const path of RANKING_PAGES) {
    const page = await fetchHtml(path);
    if (page.status !== 200) {
      add("HIGH", "page", `${path} status ${page.status}`);
      continue;
    }
    for (const pattern of FABRICATED_PATTERNS) {
      if (pattern.test(page.html)) add("CRITICAL", "fabrication", `${path} shows fabricated metric pattern`);
    }
    if (path !== "/kaomoji" && !page.html.includes("<h1")) {
      add("MEDIUM", "seo", `${path} missing H1`);
    }
  }

  const popularApi = await fetchJson<KaomojiRankingResult>("/api/kaomoji/popular?limit=24");
  apiTimes.popular = popularApi.ms;
  if (popularApi.status === 404) add("HIGH", "api", "Popular API 404 — deploy pending");
  else if (popularApi.status !== 200) add("HIGH", "api", `Popular API status ${popularApi.status}`);
  else recordsChecked += auditRankingResult("popular", popularApi.data, add);

  const trendingApi = await fetchJson<KaomojiRankingResult>("/api/kaomoji/trending?limit=24");
  apiTimes.trending = trendingApi.ms;
  if (trendingApi.status === 404) add("HIGH", "api", "Trending API 404 — deploy pending");
  else if (trendingApi.status !== 200) add("HIGH", "api", `Trending API status ${trendingApi.status}`);
  else recordsChecked += auditRankingResult("trending", trendingApi.data, add);

  const risingApi = await fetchJson<KaomojiRankingResult>("/api/kaomoji/trending?kind=rising&limit=12");
  apiTimes.rising = risingApi.ms;
  if (risingApi.status === 200) recordsChecked += auditRankingResult("rising", risingApi.data, add);

  const copiedApi = await fetchJson<KaomojiRankingResult>("/api/kaomoji/popular?kind=most_copied&limit=12");
  apiTimes.most_copied = copiedApi.ms;
  if (copiedApi.status === 200) recordsChecked += auditRankingResult("most_copied", copiedApi.data, add);

  for (const endpoint of [
    "/api/kaomoji/popular?limit=-1",
    "/api/kaomoji/popular?limit=9999",
    "/api/kaomoji/popular?category=../etc/passwd",
    "/api/kaomoji/trending?limit=DROP TABLE",
  ]) {
    const probe = await fetchJson<KaomojiRankingResult>(endpoint);
    if (probe.status >= 500) add("HIGH", "security", `${endpoint} returned ${probe.status}`);
    if (probe.text.includes("SQLITE") || probe.text.includes("stack trace")) {
      add("CRITICAL", "security", `${endpoint} leaked internal error`);
    }
  }

  const blockedPage = await fetchHtml(`/kaomoji/${BLOCKED_SLUG}`);
  if (blockedPage.status !== 404) add("CRITICAL", "blocked", `Blocked detail ${blockedPage.status}`);

  const allRankedSlugs = [
    ...(popularApi.data.items ?? []).map((i) => i.slug),
    ...(trendingApi.data.items ?? []).map((i) => i.slug),
  ];
  if (allRankedSlugs.includes(BLOCKED_SLUG)) {
    blockedLeaks++;
    add("CRITICAL", "blocked", "Blocked slug appears in rankings");
  }

  for (const slug of allRankedSlugs.slice(0, 30)) {
    const detail = await fetchHtml(`/kaomoji/${slug}`);
    if (detail.status !== 200) {
      add("HIGH", "quality", `Ranked ${slug} not public (${detail.status})`);
    }
  }

  const relatedApi = await fetchJson<{ similar?: unknown[] }>("/api/kaomoji/related?slug=kao-00013e7cc777f411");
  if (relatedApi.status === 404) add("MEDIUM", "regression", "Step 7 related API still 404");

  const searchPath = getPhase14SearchIndexPath(rootDir);
  if (existsSync(searchPath)) {
    const idx = JSON.parse(readFileSync(searchPath, "utf8"));
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    if (bench.pass !== bench.total) add("HIGH", "search", `Benchmark ${bench.pass}/${bench.total}`);
  }

  if (recordsChecked < 20 && popularApi.status === 200) {
    add("INFO", "quality", `Only ${recordsChecked} ranked records returned — likely editorial fallback`);
  }

  const pass =
    findings.filter((f) => f.severity === "CRITICAL").length === 0 &&
    findings.filter((f) => f.severity === "HIGH").length === 0 &&
    findings.filter((f) => f.severity === "MEDIUM").length === 0;

  return {
    pass,
    findings,
    build_id: buildId,
    git_sha: gitSha,
    api_performance_ms: apiTimes,
    quality_audit: { records_checked: recordsChecked, blocked_leaks: blockedLeaks },
  };
}

async function main(): Promise<void> {
  const auditLabel = process.argv.includes("--second") ? "B2" : "A1";
  const audit = await runStep8LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/kaomoji/kaomoji-step8-trending-popular.test.ts src/lib/kaomoji/kaomoji-step7-related.test.ts src/lib/kaomoji/kaomoji-phase19.test.ts src/lib/kaomoji/kaomoji-phase20.test.ts src/lib/kaomoji/kaomoji-phase21.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Phase tests failed" });
  }

  const report = {
    step: 8,
    title: "Kaomoji Trending / Popular Rankings",
    audit_label: auditLabel,
    audited_at: new Date().toISOString(),
    production_url: CUSTOM,
    build_id: audit.build_id,
    git_sha: audit.git_sha,
    quality_audit: audit.quality_audit,
    api_performance_ms: audit.api_performance_ms,
    regression: { phase_tests: phaseTests },
    findings: audit.findings,
    counts: {
      CRITICAL: audit.findings.filter((f) => f.severity === "CRITICAL").length,
      HIGH: audit.findings.filter((f) => f.severity === "HIGH").length,
      MEDIUM: audit.findings.filter((f) => f.severity === "MEDIUM").length,
      LOW: audit.findings.filter((f) => f.severity === "LOW").length,
      INFO: audit.findings.filter((f) => f.severity === "INFO").length,
    },
    pass: audit.pass && phaseTests === "PASS",
  };

  const outFile =
    auditLabel === "B2"
      ? join(finalDir, "phase-step-8-trending-popular-second-audit.json")
      : join(finalDir, "phase-step-8-trending-popular-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
