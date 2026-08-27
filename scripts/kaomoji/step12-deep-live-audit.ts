/**
 * Step 12 — deep live seasonal/event guides audit.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { EVENT_PAGE_SLUGS } from "@/lib/kaomoji/events/registry";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_SLUG = "kao-000c332b7e7b5b52";
const PUBLIC_DETAIL = "kao-00013e7cc777f411";

const EVENT_SAMPLE = [
  "new-year",
  "valentines-day",
  "halloween",
  "christmas",
  "thanksgiving",
  "birthday",
  "wedding",
  "graduation",
  "anniversary",
  "congratulations",
  "good-luck",
  "thank-you",
] as const;

const SEARCH_QUERIES = ["christmas", "halloween", "birthday", "love", "congratulations", "new year", "good luck"];

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
  const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`rel=["']canonical["'][^>]+href=["']https://emojiquick.com${esc}`, "i").test(html)
    || new RegExp(`href=["']https://emojiquick.com${esc}["'][^>]+rel=["']canonical["']`, "i").test(html);
}

function hasJsonLd(html: string, type: string): boolean {
  return new RegExp(`"@type"\\s*:\\s*"${type}"`, "i").test(html);
}

export async function runStep12LiveAudit(auditLabel: string): Promise<{
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

  const paths = [
    "/kaomoji",
    "/kaomoji/events",
    "/kaomoji/categories",
    "/kaomoji/collections",
    "/kaomoji/search",
    `/kaomoji/${PUBLIC_DETAIL}`,
    `/kaomoji/${BLOCKED_SLUG}`,
    "/kaomoji/my",
    "/sitemap.xml",
    "/robots.txt",
    ...EVENT_SAMPLE.map((s) => `/kaomoji/events/${s}`),
  ];

  let pagesChecked = 0;
  for (const path of paths) {
    pagesChecked += 1;
    const { status, text } = await fetchPage(path);

    if (path.includes(BLOCKED_SLUG)) {
      if (status !== 404) add("CRITICAL", "blocked", `Blocked slug returned ${status}`);
      continue;
    }

    if (path === "/kaomoji/my") continue;

    if (path === "/sitemap.xml") {
      if (status !== 200) add("HIGH", "sitemap", "sitemap.xml not 200");
      else {
        if (text.includes("/kaomoji/my")) add("CRITICAL", "sitemap", "Personal library in sitemap");
        if (text.includes(BLOCKED_SLUG)) add("CRITICAL", "sitemap", "Blocked slug in sitemap");
        if (!text.includes("/kaomoji/events")) add("HIGH", "sitemap", "Events index missing from sitemap");
        for (const slug of EVENT_PAGE_SLUGS.slice(0, 5)) {
          if (!text.includes(`/kaomoji/events/${slug}`)) {
            add("MEDIUM", "sitemap", `Event page /kaomoji/events/${slug} missing from sitemap`);
          }
        }
        if (/\/kaomoji\/events\/[a-z-]+-20\d{2}/.test(text)) {
          add("HIGH", "sitemap", "Year-stamped event URLs in sitemap");
        }
      }
      continue;
    }

    if (path === "/robots.txt") continue;

    if (path.startsWith("/kaomoji/events")) {
      if (status !== 200) {
        add("HIGH", "event-pages", `${path} returned ${status}`);
        continue;
      }
      if (!hasH1(text)) add("MEDIUM", "content", `${path} missing H1`);
      if (!extractTitle(text)) add("MEDIUM", "metadata", `${path} missing title`);
      if (!extractMetaDescription(text)) add("LOW", "metadata", `${path} missing meta description`);
      if (!hasCanonical(text, path)) add("LOW", "canonical", `${path} canonical not verified`);
      if (!text.toLowerCase().includes("copy")) add("MEDIUM", "ux", `${path} missing copy controls`);
      if (path !== "/kaomoji/events" && !hasJsonLd(text, "CollectionPage")) {
        add("LOW", "structured-data", `${path} missing CollectionPage JSON-LD`);
      }
      if (path !== "/kaomoji/events" && !hasJsonLd(text, "BreadcrumbList")) {
        add("LOW", "structured-data", `${path} missing BreadcrumbList JSON-LD`);
      }
      if (/\/kaomoji\/events\/[a-z-]+-20\d{2}/.test(path)) {
        add("HIGH", "urls", `Year-stamped event URL ${path}`);
      }
      continue;
    }

    if (path === "/kaomoji" && status === 200) {
      if (!text.includes("/kaomoji/events")) add("MEDIUM", "discovery", "Kaomoji hub missing events link");
    }
  }

  for (const q of SEARCH_QUERIES) {
    pagesChecked += 1;
    const { status } = await fetchPage(`/kaomoji/search?q=${encodeURIComponent(q)}`);
    if (status !== 200) add("HIGH", "search", `Search for "${q}" returned ${status}`);
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
  const audit = await runStep12LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/kaomoji/kaomoji-step12-seasonal-event-guides.test.ts src/lib/kaomoji/kaomoji-step11-seo-longtail.test.ts src/lib/kaomoji/kaomoji-step10-personal-collections.test.ts src/lib/kaomoji/kaomoji-step9-multilingual-search.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 12,
    title: "Kaomoji Seasonal & Event Guides",
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
      ? join(finalDir, "phase-step-12-seasonal-event-guides-second-audit.json")
      : join(finalDir, "phase-step-12-seasonal-event-guides-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
