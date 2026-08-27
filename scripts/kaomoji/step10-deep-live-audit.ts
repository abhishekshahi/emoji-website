/**
 * Step 10 — deep live website audit (kaomoji copy, save & personal collections).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";
const PUBLIC_SLUG = "kao-00013e7cc777f411";

interface ResolveApi {
  items?: Array<{ canonical_id: string; slug: string; content: string }>;
}

async function fetchText(path: string): Promise<{ status: number; text: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  const text = await res.text();
  return { status: res.status, text, ms: Date.now() - t0 };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T; ms: number; text: string }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { ...init, cache: "no-store" });
  const ms = Date.now() - t0;
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) as T, ms, text };
  } catch {
    return { status: res.status, data: {} as T, ms, text };
  }
}

export async function runStep10LiveAudit(auditLabel: string): Promise<{
  pass: boolean;
  findings: Finding[];
  build_id: string;
  git_sha: string;
  pages_checked: number;
  api_checks: number;
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

  let pagesChecked = 0;
  let apiChecks = 0;

  const pages = [
    "/",
    "/kaomoji",
    "/kaomoji/search",
    `/kaomoji/${PUBLIC_SLUG}`,
    "/kaomoji/my",
    "/kaomoji/popular",
    "/kaomoji/trending",
    `/kaomoji/${BLOCKED_SLUG}`,
  ];

  for (const path of pages) {
    pagesChecked += 1;
    const { status, text } = await fetchText(path);
    if (path.includes(BLOCKED_SLUG)) {
      if (status !== 404) add("CRITICAL", "blocked", `Blocked slug returned ${status}`);
      continue;
    }
    if (status !== 200) {
      add(path === "/kaomoji/my" ? "HIGH" : "MEDIUM", "pages", `${path} returned ${status}`);
      continue;
    }
    if (path === "/kaomoji/my") {
      if (!text.includes("My Kaomoji") && !text.includes("Personal library")) {
        add("HIGH", "personal-library", "/kaomoji/my missing expected UI");
      }
      if (!text.includes("locally") && !text.includes("browser")) {
        add("MEDIUM", "privacy", "/kaomoji/my missing local-storage notice");
      }
      if (text.includes("emojiquick-kaomoji-personal-v1")) {
        add("CRITICAL", "privacy", "Personal storage key leaked in HTML");
      }
    }
    if (path.includes(PUBLIC_SLUG)) {
      if (!text.includes("Copy") && !text.toLowerCase().includes("copy")) {
        add("HIGH", "copy", "Detail page missing copy control");
      }
      if (!text.includes("Save") && !text.includes("Saved")) {
        add("HIGH", "save", "Detail page missing save control");
      }
    }
  }

  const robots = await fetchText("/robots.txt");
  if (robots.status === 200 && !robots.text.includes("/kaomoji/my")) {
    add("MEDIUM", "seo", "robots.txt does not disallow /kaomoji/my");
  }

  let sitemapText = "";
  try {
    sitemapText = (await fetchText("/sitemap.xml")).text;
  } catch {
    add("LOW", "seo", "Could not fetch sitemap");
  }
  if (sitemapText.includes("/kaomoji/my")) {
    add("CRITICAL", "seo", "Personal library URL in sitemap");
  }

  apiChecks += 1;
  const resolve = await fetchJson<ResolveApi>("/api/kaomoji/personal/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ["kao_00013e7cc777f411", "kao_000c332b7e7b5b52", "<script>"] }),
  });
  if (resolve.status === 404 || resolve.status === 405) {
    add("HIGH", "api", "Personal resolve API not deployed");
  } else if (resolve.status !== 200) {
    add("MEDIUM", "api", `Resolve API returned ${resolve.status}`);
  } else {
    const ids = new Set((resolve.data.items ?? []).map((i) => i.canonical_id));
    if (!ids.has("kao_00013e7cc777f411")) add("HIGH", "api", "Resolve API missing public id");
    if (ids.has("kao_000c332b7e7b5b52")) add("CRITICAL", "blocked", "Resolve API returned blocked id");
  }

  for (const path of ["/api/kaomoji/search?q=happy&limit=3", "/api/kaomoji/popular?limit=3", "/api/kaomoji/trending?limit=3"]) {
    apiChecks += 1;
    const res = await fetchJson<{ results?: unknown[] }>(path);
    if (res.status !== 200) add("MEDIUM", "regression", `${path} returned ${res.status}`);
  }

  const searchHi = await fetchJson<{ results?: unknown[] }>("/api/kaomoji/search?q=खुश&limit=3");
  apiChecks += 1;
  if (searchHi.status !== 200 || !(searchHi.data.results?.length ?? 0)) {
    add("MEDIUM", "regression", "Step 9 Hindi search regression on production");
  }

  const crit = findings.filter((f) => f.severity === "CRITICAL").length;
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const med = findings.filter((f) => f.severity === "MEDIUM").length;
  const pass = crit === 0 && high === 0 && med === 0;

  return { pass, findings, build_id: buildId, git_sha: gitSha, pages_checked: pagesChecked, api_checks: apiChecks };
}

async function main(): Promise<void> {
  const auditLabel = process.argv.includes("--second") ? "B2" : "B1";
  const audit = await runStep10LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/kaomoji/kaomoji-step10-personal-collections.test.ts src/lib/kaomoji/kaomoji-step9-multilingual-search.test.ts src/lib/kaomoji/kaomoji-step8-trending-popular.test.ts src/lib/kaomoji/kaomoji-step7-related.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 10,
    title: "Kaomoji Copy, Save & Personal Collections",
    audit_label: auditLabel,
    audited_at: new Date().toISOString(),
    production_url: CUSTOM,
    build_id: audit.build_id,
    git_sha: audit.git_sha,
    pages_checked: audit.pages_checked,
    api_checks: audit.api_checks,
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
      ? join(finalDir, "phase-step-10-personal-collections-second-audit.json")
      : join(finalDir, "phase-step-10-personal-collections-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
