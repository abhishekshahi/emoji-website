/**
 * Step 9 — deep live website audit (multilingual kaomoji search).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { resolveMultilingualSearchQuery } from "@/lib/kaomoji/localization/multilingual-search";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";

const QUERIES_BY_LANG: Record<string, readonly string[]> = {
  en: ["happy", "love", "hug", "sad", "cute", "cat", "kawaii", "anime", "sorry", "friendship"],
  hi: ["खुश", "प्यार", "गले लगाना", "उदास", "pyara", "khush", "pyaar", "udaas", "billi", "prem"],
  es: ["feliz", "amor", "abrazo", "triste", "lindo", "gato", "cute", "love", "happy", "cat"],
  fr: ["heureux", "amour", "mignon", "chat", "triste", "calin", "happy", "love", "cute", "cat"],
  de: ["glücklich", "liebe", "suss", "katze", "traurig", "umarmung", "happy", "love", "cute", "cat"],
  pt: ["feliz", "amor", "fofo", "gato", "triste", "abraco", "happy", "love", "cute", "cat"],
  it: ["felice", "amore", "carino", "gatto", "triste", "abbraccio", "happy", "love", "cute", "cat"],
  ja: ["嬉しい", "愛", "ハグ", "悲しい", "kawaii", "neko", "happy", "love", "cute", "cat"],
  ko: ["행복", "사랑", "포옹", "슬픔", "gwiyeoun", "goyangi", "happy", "love", "cute", "cat"],
  zh: ["开心", "爱", "拥抱", "悲伤", "keai", "mao", "happy", "love", "cute", "cat"],
};

const MIXED = [
  "cute kaomoji hindi",
  "happy kaomoji 日本語",
  "love kaomoji 사랑",
  "hug emoticon abrazo",
  "feliz cat kaomoji",
  "pyara cute",
  "嬉しい happy",
  "행복 love",
  "开心 cute",
  "amor kaomoji love",
] as const;

interface SearchApi {
  results?: Array<{ canonical_id: string; slug: string; content: string }>;
  resolved_query?: string;
  language_fallback?: boolean;
}

interface SuggestApi {
  suggestions?: Array<{ term: string; locale: string }>;
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

export async function runStep9LiveAudit(auditLabel: string): Promise<{
  pass: boolean;
  findings: Finding[];
  build_id: string;
  git_sha: string;
  queries_tested: number;
  api_performance_ms: Record<string, number>;
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

  let queriesTested = 0;
  const apiTimes: Record<string, number> = {};

  for (const [lang, queries] of Object.entries(QUERIES_BY_LANG)) {
    for (const q of queries) {
      queriesTested++;
      const api = await fetchJson<SearchApi>(`/api/kaomoji/search?q=${encodeURIComponent(q)}&locale=${lang === "en" ? "auto" : lang}&limit=8`);
      apiTimes.search = Math.max(apiTimes.search ?? 0, api.ms);
      if (api.status === 404) {
        add("HIGH", "api", "Search API 404 — deploy pending");
        continue;
      }
      if (api.status !== 200) add("HIGH", "api", `${lang}/${q} status ${api.status}`);
      if ((api.data.results ?? []).length === 0 && !["garbage", "xyz"].includes(q)) {
        add("MEDIUM", "search", `${lang}/${q} returned zero results`);
      }
      const ids = (api.data.results ?? []).map((r) => r.canonical_id);
      if (new Set(ids).size !== ids.length) add("HIGH", "duplicate", `${lang}/${q} duplicate ids`);
    }
  }

  for (const q of MIXED) {
    queriesTested++;
    const api = await fetchJson<SearchApi>(`/api/kaomoji/search?q=${encodeURIComponent(q)}&limit=8`);
    if (api.status === 200 && (api.data.results ?? []).length === 0) {
      add("MEDIUM", "mixed", `Mixed query empty: ${q}`);
    }
  }

  for (const q of ["ha", "fel", "pya", "嬉", "행", "开"]) {
    const api = await fetchJson<SuggestApi>(`/api/kaomoji/search/suggest?q=${encodeURIComponent(q)}&limit=6`);
    apiTimes.suggest = Math.max(apiTimes.suggest ?? 0, api.ms);
    if (api.status === 404) add("HIGH", "suggest", "Suggest API 404 — deploy pending");
    else if (api.status !== 200) add("HIGH", "suggest", `Suggest ${q} status ${api.status}`);
  }

  const blocked = await fetchJson<SearchApi>(`/api/kaomoji/search?q=${encodeURIComponent(BLOCKED_SLUG)}&limit=5`);
  const blockedHits = (blocked.data.results ?? []).filter((r) => r.slug === BLOCKED_SLUG);
  if (blockedHits.length > 0) add("CRITICAL", "blocked", "Blocked slug searchable");

  for (const probe of [
    "/api/kaomoji/search?q=<script>alert(1)</script>",
    "/api/kaomoji/search?q=" + "a".repeat(600),
    "/api/kaomoji/search?q=test&locale=../../etc/passwd",
    "/api/kaomoji/search/suggest?q=DROP TABLE",
  ]) {
    const res = await fetchJson<SearchApi>(probe);
    if (res.status >= 500) add("HIGH", "security", `${probe} returned ${res.status}`);
    if (res.text.includes("SQLITE") || res.text.toLowerCase().includes("stack trace")) {
      add("CRITICAL", "security", `${probe} leaked internal error`);
    }
  }

  const pages = ["/kaomoji/search", "/hi/kaomoji", "/ja/kaomoji", "/es/kaomoji"];
  for (const path of pages) {
    const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
    if (res.status === 404) add("HIGH", "page", `${path} 404 — deploy pending`);
    else if (res.status !== 200) add("HIGH", "page", `${path} status ${res.status}`);
  }

  const searchPath = getPhase14SearchIndexPath(rootDir);
  if (existsSync(searchPath)) {
    const idx = JSON.parse(readFileSync(searchPath, "utf8"));
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    if (bench.pass !== bench.total) add("HIGH", "regression", `Benchmark ${bench.pass}/${bench.total}`);
    for (const q of ["feliz", "खुश", "嬉しい", "행복", "开心"]) {
      const resolved = resolveMultilingualSearchQuery(q, "auto");
      if (searchKaomojiV2(idx, resolved.resolvedQuery, 8).length === 0) {
        add("MEDIUM", "mapping", `Local mapping produced no results for ${q}`);
      }
    }
  }

  const pass =
    findings.filter((f) => f.severity === "CRITICAL").length === 0 &&
    findings.filter((f) => f.severity === "HIGH").length === 0 &&
    findings.filter((f) => f.severity === "MEDIUM").length === 0;

  return { pass, findings, build_id: buildId, git_sha: gitSha, queries_tested: queriesTested, api_performance_ms: apiTimes };
}

async function main(): Promise<void> {
  const auditLabel = process.argv.includes("--second") ? "B2" : "A1";
  const audit = await runStep9LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/kaomoji/kaomoji-step9-multilingual-search.test.ts src/lib/kaomoji/kaomoji-step8-trending-popular.test.ts src/lib/kaomoji/kaomoji-step7-related.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 9,
    title: "Kaomoji Multilingual Search",
    audit_label: auditLabel,
    audited_at: new Date().toISOString(),
    production_url: CUSTOM,
    build_id: audit.build_id,
    git_sha: audit.git_sha,
    queries_tested: audit.queries_tested,
    api_performance_ms: audit.api_performance_ms,
    regression: { step_tests: phaseTests },
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
      ? join(finalDir, "phase-step-9-multilingual-search-second-audit.json")
      : join(finalDir, "phase-step-9-multilingual-search-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
