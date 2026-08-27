/**
 * Step 7 — deep live website audit (related / similar kaomoji).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";

const DETAIL_SAMPLES = [
  "kao-00013e7cc777f411",
  "kao-000231c85784b630",
  "kao-000b1a777f4f1bb2",
  "kao-001698c24eb72787",
  "kao-0021939944d44c05",
  "kao-00455e9793fc1fb7",
  "kao-00687345aa1c84d4",
  "kao-0069d4f8387094b4",
  "kao-007156df3de39a14",
  "kao-00a8686d2ce1d6e0",
  "kao-00ead39e527ec2a8",
  "kao-018fe9a114c85b2d",
  "kao-01d1f0540e8afa01",
  "kao-6718c0cf7a018b68",
  "kao-fc681f6ae55feb5e",
  "kao-fc686c6620bbf85a",
  "kao-fc6975610b550682",
  "kao-fc69a01f224d146b",
  "kao-fc6ae407851a9dcf",
  "kao-fcad26e7d3a423b2",
  "kao-f9485e8981545c68",
  "kao-f37a85067ec9ce21",
  "kao-e970266b930d222d",
  "kao-e78f168884eb0d93",
  "kao-0081f55e2fc9e1a9",
  "kao-008717e08a02cbf6",
  "kao-00ac6df0f4400e03",
  "kao-01eca17f36574f9a",
  "kao-0011a3086a5a8a47",
  "kao-0047c46c41517429",
] as const;

async function fetchHtml(path: string): Promise<{ status: number; html: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text(), ms: Date.now() - t0 };
}

async function fetchJson<T>(path: string): Promise<{ status: number; data: T; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  const ms = Date.now() - t0;
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) as T, ms };
  } catch {
    return { status: res.status, data: {} as T, ms };
  }
}

interface RelatedApi {
  canonical_id?: string;
  similar?: Array<{ canonical_id: string; slug: string; content: string }>;
  related?: Array<{ canonical_id: string; slug: string; content: string }>;
  found?: boolean;
  rejected?: boolean;
}

export async function runStep7LiveAudit(auditLabel: string): Promise<{
  pass: boolean;
  findings: Finding[];
  build_id: string;
  git_sha: string;
  api_performance_ms: Record<string, number>;
  quality_audit: { pairs_checked: number; weak_pairs: number };
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

  const apiTimes: number[] = [];
  let qualityPairs = 0;
  let weakPairs = 0;

  for (const slug of DETAIL_SAMPLES) {
    const page = await fetchHtml(`/kaomoji/${slug}`);
    if (page.status !== 200) {
      add("HIGH", "detail", `${slug} status ${page.status}`);
      continue;
    }

    if (!page.html.includes("Related Kaomoji") && !page.html.includes("Similar Kaomoji")) {
      add("MEDIUM", "detail", `${slug} missing related section`);
    }
    if (!page.html.includes("Copy")) add("HIGH", "detail", `${slug} missing copy button`);

    const api = await fetchJson<RelatedApi>(
      `/api/kaomoji/related?slug=${encodeURIComponent(slug)}&similar_limit=6&related_limit=8`,
    );
    apiTimes.push(api.ms);

    if (api.status === 404) {
      add("MEDIUM", "api", `${slug} related API 404 — deploy pending`);
      continue;
    }
    if (api.status !== 200) add("HIGH", "api", `${slug} related API status ${api.status}`);

    const hits = [...(api.data.similar ?? []), ...(api.data.related ?? [])];
    const ids = hits.map((h) => h.canonical_id);
    const slugs = hits.map((h) => h.slug);
    const contents = hits.map((h) => h.content);

    if (api.data.canonical_id && ids.includes(api.data.canonical_id)) {
      add("CRITICAL", "self", `${slug} recommends itself`);
    }
    if (new Set(ids).size !== ids.length) add("HIGH", "duplicate", `${slug} duplicate canonical ids`);
    if (new Set(slugs).size !== slugs.length) add("HIGH", "duplicate", `${slug} duplicate slugs`);
    if (new Set(contents).size !== contents.length) add("MEDIUM", "duplicate", `${slug} duplicate content`);

    for (const hit of hits.slice(0, 4)) {
      qualityPairs++;
      const detail = await fetchHtml(`/kaomoji/${hit.slug}`);
      if (detail.status !== 200) {
        weakPairs++;
        add("HIGH", "quality", `Recommended ${hit.slug} not public (${detail.status})`);
      }
    }
  }

  const blockedPage = await fetchHtml(`/kaomoji/${BLOCKED_SLUG}`);
  if (blockedPage.status !== 404) add("CRITICAL", "blocked", `Blocked detail ${blockedPage.status}`);

  const blockedApi = await fetchJson<RelatedApi>(`/api/kaomoji/related?slug=${encodeURIComponent(BLOCKED_SLUG)}`);
  if (blockedApi.status === 200) {
    const blockedHits = [...(blockedApi.data.similar ?? []), ...(blockedApi.data.related ?? [])];
    if (blockedHits.length > 0) add("CRITICAL", "blocked", "Blocked slug returned related hits");
  }

  const badApi = await fetchJson<RelatedApi>("/api/kaomoji/related?canonical_id=DROP TABLE");
  if (badApi.status === 200 && !badApi.data.rejected) {
    add("HIGH", "security", "SQL injection param not rejected");
  }

  const sorted = [...apiTimes].sort((a, b) => a - b);
  const perf = {
    count: sorted.length,
    min: sorted[0] ?? 0,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
  if (perf.p95 > 8000) add("MEDIUM", "performance", `Related API p95 ${perf.p95}ms`);

  const searchPath = getPhase14SearchIndexPath(rootDir);
  if (existsSync(searchPath)) {
    const idx = JSON.parse(readFileSync(searchPath, "utf8"));
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    if (bench.pass !== bench.total) add("HIGH", "search", `Benchmark ${bench.pass}/${bench.total}`);
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
    api_performance_ms: perf,
    quality_audit: { pairs_checked: qualityPairs, weak_pairs: weakPairs },
  };
}

async function main(): Promise<void> {
  const first = await runStep7LiveAudit("A1");
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync("npx tsx --test src/lib/kaomoji/kaomoji-step7-related.test.ts src/lib/kaomoji/kaomoji-phase19.test.ts src/lib/kaomoji/kaomoji-phase20.test.ts src/lib/kaomoji/kaomoji-phase21.test.ts", {
      cwd: rootDir,
      stdio: "pipe",
      encoding: "utf8",
      timeout: 600000,
    });
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    first.findings.push({ id: "A1-F99", severity: "HIGH", area: "regression", message: "Phase tests failed" });
  }

  const report = {
    step: 7,
    title: "Kaomoji Related / Similar",
    audited_at: new Date().toISOString(),
    production_url: CUSTOM,
    build_id: first.build_id,
    git_sha: first.git_sha,
    quality_audit: first.quality_audit,
    api_performance_ms: first.api_performance_ms,
    regression: { phase_tests: phaseTests },
    findings: first.findings,
    counts: {
      CRITICAL: first.findings.filter((f) => f.severity === "CRITICAL").length,
      HIGH: first.findings.filter((f) => f.severity === "HIGH").length,
      MEDIUM: first.findings.filter((f) => f.severity === "MEDIUM").length,
      LOW: first.findings.filter((f) => f.severity === "LOW").length,
      INFO: first.findings.filter((f) => f.severity === "INFO").length,
    },
    pass: first.pass && phaseTests === "PASS",
  };

  writeFileSync(join(finalDir, "phase-step-7-related-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
