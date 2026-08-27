/**
 * Step 14 — deep live invisible character tools audit.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { INVISIBLE_TOOL_SLUGS } from "@/lib/tools/invisible-characters/registry";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const CUSTOM = "https://emojiquick.com";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding { id: string; severity: Severity; area: string; message: string }

const BLOCKED_KAO = "kao-000c332b7e7b5b52";

async function fetchPage(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${CUSTOM}${path}`, { cache: "no-store" });
  return { status: res.status, text: await res.text() };
}

function hasH1(html: string): boolean {
  return /<h1[^>]*>/i.test(html);
}

function hasUnsafeScript(html: string): boolean {
  return /<script[^>]*>[^<]*alert\s*\(/i.test(html);
}

export async function runStep14LiveAudit(auditLabel: string): Promise<{
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
    "/tools/invisible-characters",
    ...INVISIBLE_TOOL_SLUGS.map((s) => `/tools/invisible-characters/${s}`),
    "/kaomoji/search?q=happy",
    `/kaomoji/${BLOCKED_KAO}`,
    "/sitemap.xml",
    "/robots.txt",
  ];

  let pagesChecked = 0;
  for (const path of paths) {
    pagesChecked += 1;
    const { status, text } = await fetchPage(path);

    if (path.includes(BLOCKED_KAO)) {
      if (status !== 404) add("CRITICAL", "blocked", `Blocked kaomoji returned ${status}`);
      continue;
    }

    if (path === "/sitemap.xml") {
      if (status !== 200) add("HIGH", "sitemap", "sitemap.xml not 200");
      else if (!text.includes("/tools/invisible-characters")) {
        add("HIGH", "sitemap", "Invisible tools missing from sitemap");
      }
      continue;
    }

    if (path === "/robots.txt") {
      if (status === 200 && !text.includes("/tools/")) add("MEDIUM", "robots", "robots missing /tools/ allow");
      continue;
    }

    if (path.startsWith("/tools/invisible-characters")) {
      if (status !== 200) {
        add("HIGH", "tools", `${path} returned ${status}`);
        continue;
      }
      if (!hasH1(text)) add("MEDIUM", "content", `${path} missing H1`);
      if (!text.toLowerCase().includes("client")) add("LOW", "privacy", `${path} missing client-side note`);
      if (hasUnsafeScript(text)) add("CRITICAL", "security", `${path} possible unsafe script reflection`);
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
  const audit = await runStep14LiveAudit(auditLabel);
  mkdirSync(finalDir, { recursive: true });

  let phaseTests = "skipped";
  try {
    execSync(
      "npx tsx --test src/lib/tools/invisible-characters-step14.test.ts src/lib/emoji/kaomoji-step13-platform-comparison.test.ts",
      { cwd: rootDir, stdio: "pipe", encoding: "utf8", timeout: 600000 },
    );
    phaseTests = "PASS";
  } catch {
    phaseTests = "FAIL";
    audit.findings.push({ id: `${auditLabel}-F99`, severity: "HIGH", area: "regression", message: "Step tests failed" });
  }

  const report = {
    step: 14,
    title: "Invisible Characters Tools",
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
      ? join(finalDir, "phase-step-14-invisible-characters-second-audit.json")
      : join(finalDir, "phase-step-14-invisible-characters-first-audit.json");

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
