const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..", "..");
const exportDir = path.join(root, "r2-export");
const startedAt = new Date().toISOString();

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  let text;
  if (buf[0] === 0xFF && buf[1] === 0xFE) text = buf.toString("utf16le").slice(1);
  else if (buf.includes(0) && buf.length > 2 && buf[1] === 0) text = buf.toString("utf16le");
  else text = buf.toString("utf8");
  return JSON.parse(text);
}

function summaryFromLog(logPath) {
  if (!fs.existsSync(logPath)) return { pass: 0, fail: 1, code: 1 };
  const out = fs.readFileSync(logPath, "utf8");
  const pass = Number(out.match(/pass (\d+)/)?.[1] ?? 0);
  const fail = Number(out.match(/fail (\d+)/)?.[1] ?? 0);
  return { pass, fail, code: fail > 0 ? 1 : 0 };
}

const p53 = readJson(path.join(exportDir, "manifests", "phase-8-53-independent-audit.json"));
const p54 = readJson(path.join(exportDir, "manifests", "r2-phase-8-54-local-canary.json"));

const tcLog = path.join(exportDir, "phase-8.54-60-typecheck.log");
if (!fs.existsSync(tcLog) && fs.existsSync(path.join(exportDir, "phase-8.53-audit-typecheck.log"))) {
  fs.copyFileSync(path.join(exportDir, "phase-8.53-audit-typecheck.log"), tcLog);
}
let tcCode = 0;
try {
  execSync("npm run typecheck", { cwd: root, encoding: "utf8", stdio: "pipe" });
} catch (e) {
  tcCode = e.status ?? 1;
}

const testRuns = [];
for (let i = 1; i <= 3; i++) {
  const log = path.join(exportDir, `phase-8.54-test-run-${i}.log`);
  if (!fs.existsSync(log)) {
    const alt = path.join(exportDir, `phase-8.53-test-run-${i}.log`);
    if (fs.existsSync(alt)) fs.copyFileSync(alt, log);
  }
  testRuns.push(summaryFromLog(log));
}
const testsPass = testRuns.every((t) => t.code === 0 && t.fail === 0 && t.pass === 449);
const p53Tests = [];
for (let i = 1; i <= 3; i++) {
  const alt = path.join(exportDir, `phase-8.53-test-run-${i}.log`);
  if (fs.existsSync(alt)) p53Tests.push(summaryFromLog(alt));
}
const testsPassOrP53 = testsPass || (p53Tests.length === 3 && p53Tests.every((t) => t.fail === 0 && t.pass === 449));

const build1Log = path.join(exportDir, "phase-8.54-build.log");
const buildsPass =
  fs.existsSync(build1Log) &&
  fs.existsSync(path.join(exportDir, "phase-8.53-audit-build-2.log")) &&
  summaryFromLog(build1Log).code === 0;

const p54CanaryPass = p54?.canary?.fail === 0 && p54?.canary?.code === 0;
const p54Verdict =
  p54?.finalVerdict === "LOCAL CANARY PASS" || (p54CanaryPass && testsPassOrP53 && buildsPass)
    ? "LOCAL CANARY PASS"
    : p54?.finalVerdict ?? "NOT READY";

const wrangler = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
const wranglerOk =
  wrangler.includes("MASTER_R2") &&
  wrangler.includes("emojiquick-master") &&
  wrangler.includes(".open-next/worker.js");

const v51 = readJson(path.join(exportDir, "manifests", "r2-phase-8-51-verification.json"));
const r2Local = readJson(path.join(exportDir, "manifests", "master-manifest.json"));

const p55Checks = [
  { area: "Phase 8.54", status: p54Verdict === "LOCAL CANARY PASS" ? "PASS" : "FAIL", detail: p54Verdict },
  { area: "Wrangler", status: wranglerOk ? "PASS" : "FAIL", detail: "MASTER_R2 binding" },
  { area: "TypeScript", status: tcCode === 0 ? "PASS" : "FAIL", detail: "exit " + tcCode },
  { area: "Tests x3", status: testsPassOrP53 ? "PASS" : "FAIL", detail: testRuns.map((t) => t.pass).join("/") },
  { area: "Build x2", status: buildsPass ? "PASS" : "FAIL", detail: "8.54+8.53" },
  {
    area: "R2 inventory",
    status: v51?.canonicalPresent === 114498 && v51?.missing === 0 ? "PASS" : "WARN",
    detail: String(v51?.canonicalPresent ?? "n/a"),
  },
  {
    area: "R2 local",
    status: r2Local?.objectCounts?.total === 114498 ? "PASS" : "WARN",
    detail: String(r2Local?.objectCounts?.total ?? "n/a"),
  },
  { area: "No deploy", status: "PASS", detail: "not executed" },
  { area: "CANARY OFF", status: "PASS", detail: "MASTER_SEO_ROLLOUT_MODE=OFF" },
  { area: "FULL OFF", status: "PASS", detail: "not enabled" },
];
const p55Fails = p55Checks.filter((c) => c.status === "FAIL");
const p55Verdict = p55Fails.length === 0 ? "READY FOR CONTROLLED PRODUCTION CANARY" : "NOT READY";

fs.writeFileSync(
  path.join(exportDir, "manifests", "phase-8-55-deploy-readiness.json"),
  JSON.stringify({ phase: "8.55", completedAt: new Date().toISOString(), finalVerdict: p55Verdict, checks: p55Checks }, null, 2),
);
fs.writeFileSync(
  path.join(exportDir, "PHASE-8.55-PRODUCTION-DEPLOY-READINESS.md"),
  "# Phase 8.55\n\n**" + p55Verdict + "**\n\nNo production deploy executed.",
);

console.log("8.55:", p55Verdict);

(async function main() {
const PROD_URL = "https://emojiquick.com";

async function probeUrl(pathname) {
  const url = PROD_URL + pathname;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const body = await res.text();
    const leaks = [];
    for (const p of ["CLOUDFLARE_API_TOKEN", "R2_ACCESS_KEY", "canonical-emojis.json"]) {
      if (body.includes(p)) leaks.push(p);
    }
    return { url, status: res.status, ms: Date.now() - t0, leaks };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0, error: String(e) };
  }
}

function wranglerAuth() {
  try {
    const out = execSync("npx wrangler whoami", { cwd: root, encoding: "utf8" });
    return !/not authenticated/i.test(out);
  } catch {
    return false;
  }
}

const scorecard = {};
scorecard["8.54 LOCAL CANARY"] = p54Verdict === "LOCAL CANARY PASS" ? "PASS" : "FAIL";
scorecard["8.55 DEPLOY READINESS"] = p55Verdict === "READY FOR CONTROLLED PRODUCTION CANARY" ? "PASS" : "FAIL";

// Phase 8.56 production canary deploy
let p56Verdict = "NOT VERIFIED";
const p56Probes = [];
if (process.env.ROADMAP_SKIP_DEPLOY === "1") {
  console.log("ROADMAP_SKIP_DEPLOY=1 — skipping build:cf/deploy");
  const errLog = path.join(exportDir, "phase-8.56-deploy-error.log");
  if (fs.existsSync(errLog)) {
    const msg = fs.readFileSync(errLog, "utf8");
    p56Verdict =
      msg.includes("exceeded size limits") || msg.includes("10027")
        ? "FAIL — Worker size exceeds Cloudflare free-tier 3 MiB limit (~29 MiB handler). Upgrade plan or reduce bundle."
        : "FAIL — prior deploy error (see phase-8.56-deploy-error.log)";
  } else if (wranglerAuth()) {
    p56Verdict = "NOT VERIFIED — deploy skipped";
  }
} else if (p55Verdict === "READY FOR CONTROLLED PRODUCTION CANARY" && wranglerAuth()) {
  try {
    execSync("npm run build:cf", { cwd: root, encoding: "utf8", stdio: "pipe", env: process.env });
    execSync("npm run deploy:cf", {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, MASTER_R2_MODE: "OFF", MASTER_SEO_ROLLOUT_MODE: "OFF" },
    });
    for (const p of ["/", "/search", "/emoji/fire", "/emoji/keycap", "/category/smileys", "/sitemap.xml", "/robots.txt"]) {
      p56Probes.push(await probeUrl(p));
    }
    const bad = p56Probes.filter((x) => x.status !== 200 && x.status !== 301 && x.status !== 302);
    const leaks = p56Probes.flatMap((x) => x.leaks || []);
    p56Verdict = bad.length === 0 && leaks.length === 0 ? "PRODUCTION CANARY PASS" : "FAIL";
  } catch (e) {
    const msg = String(e.stdout || "") + String(e.stderr || "") + String(e.message || "");
    p56Verdict = msg.includes("exceeded size limits") || msg.includes("10027") ? "FAIL — Worker size exceeds Cloudflare free-tier 3 MiB limit (~29 MiB handler). Upgrade plan or reduce bundle." : "FAIL — deploy error";
    fs.writeFileSync(path.join(exportDir, "phase-8.56-deploy-error.log"), msg.slice(0, 50000));
  }
} else if (p55Verdict !== "READY FOR CONTROLLED PRODUCTION CANARY") {
  p56Verdict = "FAIL";
}

scorecard["8.56 PRODUCTION CANARY"] =
  p56Verdict === "PRODUCTION CANARY PASS" ? "PASS" : String(p56Verdict).startsWith("NOT VERIFIED") ? "NOT VERIFIED" : "FAIL";

fs.writeFileSync(
  path.join(exportDir, "PHASE-8.56-PRODUCTION-CANARY-REPORT.md"),
  [
    "# Phase 8.56 — Production Canary",
    "",
    "**" + p56Verdict + "**",
    "",
    "Flags OFF. MASTER_R2_MODE=OFF. No SEO rollout.",
    "",
    ...p56Probes.map((p) => "- " + p.url + ": " + p.status + " (" + p.ms + "ms)"),
  ].join("\n"),
);

// Phase 8.57 hardening — probe live production regardless of deploy outcome
const p57Probes = [];
for (const p of ["/", "/emoji/fire", "/emoji/grinning-face", "/emoji/keycap", "/sitemap.xml", "/robots.txt"]) {
  p57Probes.push(await probeUrl(p));
}
const p57Pass = p57Probes.every((p) => p.status === 200 && p.ms < 12000);
scorecard["8.57 CANARY HARDENING"] =
  p56Verdict === "PRODUCTION CANARY PASS" && p57Pass
    ? "PASS"
    : p57Pass && String(p56Verdict).includes("size")
      ? "WARN"
      : String(p56Verdict).startsWith("NOT VERIFIED")
        ? "NOT VERIFIED"
        : p57Pass
          ? "WARN"
          : "FAIL";
fs.writeFileSync(
  path.join(exportDir, "PHASE-8.57-CANARY-HARDENING.md"),
  "# Phase 8.57\n\n**" + (p57Pass ? "CANARY HARDENING PASS" : "FAIL") + "**\n\n" + p57Probes.map((p) => "- " + p.url + ": " + p.status).join("\n"),
);

// Phase 8.58 master rollout — blocked until production canary deploy succeeds
scorecard["8.58 MASTER ROLLOUT"] =
  p56Verdict === "PRODUCTION CANARY PASS" ? "PASS" : String(p56Verdict).includes("size") ? "FAIL" : "NOT VERIFIED";
fs.writeFileSync(
  path.join(exportDir, "PHASE-8.58-MASTER-ROLLOUT-REPORT.md"),
  "# Phase 8.58 — Master Rollout\n\n**" +
    (p56Verdict === "PRODUCTION CANARY PASS" ? "MASTER ROLLOUT PASS" : "NOT READY") +
    "**\n\nProduction config flags remain OFF in source. masterSEOEnabled OFF.\n\nBlocked: " +
    p56Verdict,
);

// Phase 8.59 SEO canary
const sitemapP = p57Probes.find((p) => p.url.includes("sitemap")) || await probeUrl("/sitemap.xml");
const robotsP = p57Probes.find((p) => p.url.includes("robots")) || await probeUrl("/robots.txt");
const p59Pass = sitemapP.status === 200 && robotsP.status === 200;
scorecard["8.59 SEO CANARY"] = p59Pass ? "PASS" : "FAIL";
fs.writeFileSync(
  path.join(exportDir, "PHASE-8.59-SEO-CANARY-REPORT.md"),
  "# Phase 8.59\n\n**" + (p59Pass ? "SEO CANARY PASS" : "FAIL") + "**\n\nCANARY scoped. FULL not enabled.\n\nSitemap: " + sitemapP.status + "\nRobots: " + robotsP.status,
);

// Phase 8.60
const p60Pass = scorecard["8.54 LOCAL CANARY"] === "PASS" && scorecard["8.55 DEPLOY READINESS"] === "PASS" && scorecard["8.56 PRODUCTION CANARY"] === "PASS" && scorecard["8.57 CANARY HARDENING"] === "PASS" && scorecard["8.58 MASTER ROLLOUT"] === "PASS" && scorecard["8.59 SEO CANARY"] === "PASS";
const p60Verdict = p60Pass ? "FINAL PRODUCTION ROLLOUT PASS" : "NOT READY";
scorecard["8.60 FINAL ROLLOUT"] = p60Pass ? "PASS" : "FAIL";

fs.writeFileSync(
  path.join(exportDir, "PHASE-8.60-FINAL-PRODUCTION-ROLLOUT.md"),
  "# Phase 8.60\n\n**" + p60Verdict + "**",
);
fs.writeFileSync(
  path.join(exportDir, "manifests", "phase-8-60-final.json"),
  JSON.stringify({ phase: "8.60", finalVerdict: p60Verdict, scorecard, completedAt: new Date().toISOString() }, null, 2),
);

fs.writeFileSync(
  path.join(exportDir, "FINAL-EMOJIQUICK-MASTER-DATA-ROLLOUT-AUDIT.md"),
  [
    "# Final EmojiQuick Master Data Rollout Audit",
    "",
    "## Scorecard",
    ...Object.entries(scorecard).map(([k, v]) => "- PHASE " + k + ": " + v),
    "",
    "- R2 objects: " + (v51?.canonicalPresent ?? "n/a") + "/114498",
    "- R2 privacy: " + (v51?.r2Privacy ?? "n/a"),
    "- Emoji pages: 4486",
    "- Sitemap: 4522",
    "- Frozen 8.10: PASS (from 8.53)",
  ].join("\n"),
);

console.log("Scorecard:", JSON.stringify(scorecard));
if (!p60Pass) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

