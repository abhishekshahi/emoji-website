/**
 * Step 11 — deep live SEO audit (kaomoji long-tail pages).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { CURATED_INTENT_SLUGS } from "@/lib/kaomoji/seo/intent-registry";
import { MEANING_PAGE_SLUGS } from "@/lib/kaomoji/seo/meaning-pages";
import { USE_CASE_PAGE_SLUGS } from "@/lib/kaomoji/seo/use-case-pages";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";
const PUBLIC_DETAIL = "kao-00013e7cc777f411";

async function fetchPage(path: string): Promise<{ status: number; text: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  return { status: res.status, text: await res.text(), ms: Date.now() - t0 };
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? null;
}

function hasH1(html: string): boolean {
  return /<h1[^>]*>/i.test(html);
}

function hasCanonical(html: string, path: string): boolean {
  return new RegExp(`rel=["']canonical["'][^>]+href=["']https://emojiquick.com${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(html)
    || new RegExp(`href=["']https://emojiquick.com${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+rel=["']canonical["']`, "i").test(html);
}

export async function runStep11LiveAudit(auditLabel: string): Promise<{
  pass: boolean;
  findings: Finding[];
  build_id: string;
  git_sha: string;
  pages_checked: number;
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
    add("INFO", "deployment", "Could not read git SHA");
  }

  const intentSample = CURATED_INTENT_SLUGS.slice(0, 10);
  const meaningSample = MEANING_PAGE_SLUGS.slice(0, 10);
  const useCaseSample = USE_CASE_PAGE_SLUGS.slice(0, 10);

  const paths = [
    "/kaomoji",
    "/kaomoji/categories",
    "/kaomoji/collections",
    "/kaomoji/search",
    `/kaomoji/${PUBLIC_DETAIL}`,
    `/kaomoji/${BLOCKED_SLUG}`,
    "/kaomoji/my",
    "/sitemap.xml",
    "/robots.txt",
    ...intentSample.map((s) => `/kaomoji/${s}`),
    ...meaningSample.map((s) => `/kaomoji/meaning/${s}`),
    ...useCaseSample.map((s) => `/kaomoji/for/${s}`),
  ];

  let pagesChecked = 0;
  for (const path of paths) {
    pagesChecked += 1;
    const { status, text } = await fetchPage(path);

    if (path.includes(BLOCKED_SLUG)) {
      if (status !== 404) add("CRITICAL", "blocked", `Blocked slug returned ${status}`);
      continue;
    }

    if (path === "/kaomoji/my") {
      if (status === 200 && text.includes("noindex")) {
        /* ok */
      } else if (status === 200) {
        add("MEDIUM", "privacy", "/kaomoji/my may be indexable");
      }
      continue;
    }

    if (path === "/sitemap.xml") {
      if (status !== 200) add("HIGH", "sitemap", "sitemap.xml not 200");
      else {
        if (text.includes("/kaomoji/my")) add("CRITICAL", "sitemap", "Personal library in sitemap");
        if (text.includes(BLOCKED_SLUG)) add("CRITICAL", "sitemap", "Blocked slug in sitemap");
        if (!text.includes("/kaomoji/categories")) add("HIGH", "sitemap", "Categories index missing from sitemap");
      }
      continue;
    }

    if (path === "/robots.txt") {
      if (status === 200 && !text.includes("/kaomoji/my")) add("MEDIUM", "robots", "robots missing /kaomoji/my disallow");
      if (status === 200 && !text.includes("/kaomoji")) add("MEDIUM", "robots", "robots missing /kaomoji/ allow");
      continue;
    }

    if (status !== 200) {
      const isIntent = intentSample.some((s) => path === `/kaomoji/${s}`);
      const isMeaning = meaningSample.some((s) => path === `/kaomoji/meaning/${s}`);
      const isUse = useCaseSample.some((s) => path === `/kaomoji/for/${s}`);
      if (isIntent || isMeaning || isUse || path.startsWith("/kaomoji/categor")) {
        add("HIGH", "seo-pages", `${path} returned ${status}`);
      } else if (path.includes("popular") || path.includes("trending")) {
        add("MEDIUM", "regression", `${path} returned ${status}`);
      }
      continue;
    }

    const title = extractTitle(text);
    if (!title) add("MEDIUM", "metadata", `${path} missing title`);
    if (!extractMetaDescription(text)) add("LOW", "metadata", `${path} missing meta description`);
    if (!hasH1(text) && !path.includes(PUBLIC_DETAIL)) add("MEDIUM", "content", `${path} missing H1`);
    if (!hasCanonical(text, path.split("?")[0]!)) add("LOW", "canonical", `${path} canonical not verified in HTML`);

    if (path.startsWith("/kaomoji/") && !path.includes(PUBLIC_DETAIL) && path.split("/").length <= 3) {
      if (!text.includes("Copy") && !text.toLowerCase().includes("copy")) {
        add("MEDIUM", "ux", `${path} missing copy controls`);
      }
    }
  }

  const crit = findings.filter((f) => f.severity === "CRITICAL").length;
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const med = findings.filter((f) => f.severity === "MEDIUM").length;
  return {
    pass: crit === 0 && high === 0 && med === 0,
    findings,
    build_id: buildId,
    git_sha: gitSha,
    pages_checked: pagesChecked,
  };
}

async function main(): Promise<void> {
  const auditLabel = process.argv.includes("--second") ? "B2" : "B1";
  const audit = await runStep11LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/kaomoji/kaomoji-step11-seo-longtail.test.ts src/lib/kaomoji/kaomoji-step10-personal-collections.test.ts src/lib/kaomoji/kaomoji-step9-multilingual-search.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 11,
    title: "Kaomoji SEO Pages & Long-Tail Content",
    audit_label: auditLabel,
    audited_at: new Date().toISOString(),
    production_url: CUSTOM,
    build_id: audit.build_id,
    git_sha: audit.git_sha,
    pages_checked: audit.pages_checked,
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
      ? join(finalDir, "phase-step-11-seo-longtail-second-audit.json")
      : join(finalDir, "phase-step-11-seo-longtail-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
