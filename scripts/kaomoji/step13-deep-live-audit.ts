/**
 * Step 13 — deep live platform comparison audit.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { PLATFORM_PAGE_SLUGS } from "@/lib/emoji/platforms/registry";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_KAO_SLUG = "kao-000c332b7e7b5b52";
const SAMPLE_EMOJI = "grinning-face";
const SAMPLE_KAO = "kao-00013e7cc777f411";

async function fetchPage(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  return { status: res.status, text: await res.text() };
}

function hasH1(html: string): boolean {
  return /<h1[^>]*>/i.test(html);
}

function hasMisleadingClaim(html: string): boolean {
  const bad = [
    /apple color emoji screenshot/i,
    /samsung one ui screenshot/i,
    /whatsapp artwork hosted/i,
    /guaranteed to look the same on every device/i,
  ];
  return bad.some((re) => re.test(html));
}

export async function runStep13LiveAudit(auditLabel: string): Promise<{
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
    "/emoji/platforms",
    ...PLATFORM_PAGE_SLUGS.map((s) => `/emoji/platforms/${s}`),
    `/emoji/${SAMPLE_EMOJI}`,
    `/kaomoji/${SAMPLE_KAO}`,
    `/kaomoji/${BLOCKED_KAO_SLUG}`,
    "/kaomoji/search?q=happy",
    "/sitemap.xml",
  ];

  let pagesChecked = 0;
  for (const path of paths) {
    pagesChecked += 1;
    const { status, text } = await fetchPage(path);

    if (path.includes(BLOCKED_KAO_SLUG)) {
      if (status !== 404) add("CRITICAL", "blocked", `Blocked kaomoji returned ${status}`);
      continue;
    }

    if (path === "/sitemap.xml") {
      if (status !== 200) add("HIGH", "sitemap", "sitemap.xml not 200");
      else {
        if (!text.includes("/emoji/platforms")) add("HIGH", "sitemap", "Platform index missing from sitemap");
        if (text.includes(BLOCKED_KAO_SLUG)) add("CRITICAL", "sitemap", "Blocked slug in sitemap");
        if (text.includes("/kaomoji/my")) add("CRITICAL", "sitemap", "Personal library in sitemap");
      }
      continue;
    }

    if (path.startsWith("/emoji/platforms") || path === `/emoji/${SAMPLE_EMOJI}`) {
      if (status !== 200) {
        add("HIGH", "platform-pages", `${path} returned ${status}`);
        continue;
      }
      if (!hasH1(text)) add("MEDIUM", "content", `${path} missing H1`);
      if (hasMisleadingClaim(text)) add("HIGH", "accuracy", `${path} may contain misleading platform claims`);
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
  const audit = await runStep13LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/emoji/kaomoji-step13-platform-comparison.test.ts src/lib/kaomoji/kaomoji-step12-seasonal-event-guides.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 13,
    title: "Platform Emoji / Kaomoji Comparison",
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
      ? join(finalDir, "phase-step-13-platform-comparison-second-audit.json")
      : join(finalDir, "phase-step-13-platform-comparison-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
