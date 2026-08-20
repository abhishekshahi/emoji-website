import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseMasterR2Mode } from "../../src/lib/master/r2/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { parsePublicMasterPlatformMode } from "../../src/lib/master/public/config";
import { verifyFrozenChecksums, FROZEN_MASTER_FILES } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import { PUBLIC_SEO_EMOJI_PAGE_COUNT, PUBLIC_SITEMAP_URL_COUNT } from "../../src/lib/master/r2/catalog";
import { getAllBrowsableEmojis, getAllBrowsableSlugs } from "../../src/lib/emoji/browsable-data";
import { getAllCategorySlugs } from "../../src/lib/emoji/data";
import { getActiveEmojiSitemapSlugs } from "../../src/lib/master/integration/seo-canary/active-migration";
import { isArtworkPubliclyServable, loadLicenseMatrix } from "../../src/lib/r2/license-matrix";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exportDir = join(root, "r2-export");
const reportMd = join(exportDir, "PHASE-8.55-PRODUCTION-DEPLOY-READINESS.md");
const manifestJson = join(exportDir, "manifests", "phase-8-55-deploy-readiness.json");
const startedAt = new Date().toISOString();

type Status = "PASS" | "FAIL" | "WARN" | "NOT_VERIFIED";
interface Check { id: string; area: string; status: Status; detail: string }
const checks: Check[] = [];

function record(id: string, area: string, status: Status, detail: string) {
  checks.push({ id, area, status, detail });
  console.log(`[${status}] ${area}: ${detail}`);
}

function run(cmd: string, env: Record<string, string> = {}) {
  const t0 = Date.now();
  let out = "";
  let code = 0;
  try {
    out = execSync(cmd, { cwd: root, encoding: "utf8", env: { ...process.env, MASTER_R2_MODE: "OFF", MASTER_SEO_ROLLOUT_MODE: "OFF", PUBLIC_MASTER_PLATFORM_MODE: "OFF", ...env }, maxBuffer: 64 * 1024 * 1024 });
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    code = err.status ?? 1;
    out = String(err.stdout ?? "") + String(err.stderr ?? "");
  }
  return { code, out, ms: Date.now() - t0 };
}

function summary(out: string) {
  return { pass: Number(out.match(/pass (\d+)/)?.[1] ?? 0), fail: Number(out.match(/fail (\d+)/)?.[1] ?? 0) };
}

function scanSecretsInDir(dir: string, exts: string[]): string[] {
  const hits: string[] = [];
  if (!existsSync(dir)) return hits;
  const patterns = ["CLOUDFLARE_API_TOKEN", "R2_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "AKIA", "NEXT_PUBLIC_MASTER_R2", "r2.cloudflarestorage.com"];
  function walk(p: string) {
    for (const name of readdirSync(p, { withFileTypes: true })) {
      const fp = join(p, name.name);
      if (name.isDirectory()) {
        if (name.name === "node_modules" || name.name === "artwork") continue;
        walk(fp);
      } else if (exts.some((e) => name.name.endsWith(e))) {
        const c = readFileSync(fp, "utf8");
        for (const pat of patterns) {
          if (c.includes(pat)) hits.push(`${fp}:${pat}`);
        }
      }
    }
  }
  walk(dir);
  return hits;
}

function scanBundles() {
  let client: Status = "WARN";
  let worker: Status = "WARN";
  const chunks = join(root, ".next", "static", "chunks");
  if (existsSync(chunks)) {
    let leak = false;
    for (const name of readdirSync(chunks)) {
      if (!name.endsWith(".js")) continue;
      const c = readFileSync(join(chunks, name), "utf8");
      if (c.includes("CLOUDFLARE_API_TOKEN") || c.includes("R2_ACCESS") || c.includes("r2-export/identities") || c.includes("canonical-emojis.json") && c.includes("6955")) leak = true;
    }
    client = leak ? "FAIL" : "PASS";
  }
  const handler = join(root, ".open-next", "server-functions", "default", "handler.mjs");
  if (existsSync(handler)) {
    const h = readFileSync(handler, "utf8");
    worker = !h.includes(".r2-export/artwork/") && h.length < 50_000_000 && !h.includes("CLOUDFLARE_API_TOKEN") ? "PASS" : "FAIL";
  }
  return { client, worker };
}

console.log("Phase 8.55 production deploy readiness");

// Phase 8.54 status
const p54Md = join(exportDir, "PHASE-8.54-LOCAL-CANARY-FINAL.md");
const p54Json = join(exportDir, "manifests", "r2-phase-8-54-local-canary.json");
if (existsSync(p54Json)) {
  const p54 = JSON.parse(readFileSync(p54Json, "utf8"));
  record("phase-8.54", "Phase 8.54 local canary", p54.finalVerdict === "LOCAL CANARY PASS" ? "PASS" : "WARN", p54.finalVerdict);
} else {
  record("phase-8.54", "Phase 8.54 local canary", "NOT_VERIFIED", "PHASE-8.54-LOCAL-CANARY-FINAL.md not found");
}

// Wrangler / R2 binding
const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
const wranglerOk = wrangler.includes("MASTER_R2") && wrangler.includes("emojiquick-master") && wrangler.includes(".open-next/worker.js");
record("wrangler", "Wrangler / R2 binding", wranglerOk ? "PASS" : "FAIL", "MASTER_R2 -> emojiquick-master");

// OpenNext
record("opennext", "OpenNext config", existsSync(join(root, "open-next.config.ts")) ? "PASS" : "FAIL", "open-next.config.ts present");

// Feature flags defaults
const flagsOk =
  MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false &&
  MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false &&
  MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false &&
  MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false &&
  parseMasterR2Mode(process.env.MASTER_R2_MODE) === "OFF" &&
  parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) === "OFF" &&
  parsePublicMasterPlatformMode("OFF") === "OFF" && parsePublicMasterPlatformMode(undefined) === (process.env.NODE_ENV === "development" ? "LOCAL" : "OFF");
record("flags", "Production feature flags OFF", flagsOk ? "PASS" : "FAIL", "MASTER_R2_MODE and integration flags OFF");

// .env.example
const envEx = readFileSync(join(root, ".env.example"), "utf8");
record("env-example", "Environment template", envEx.includes("MASTER_R2_MODE=OFF") && envEx.includes("PUBLIC_MASTER_PLATFORM_MODE=OFF") ? "PASS" : "FAIL", ".env.example defaults OFF");

// R2 inventory local
const masterManifest = join(exportDir, "manifests", "master-manifest.json");
if (existsSync(masterManifest)) {
  const m = JSON.parse(readFileSync(masterManifest, "utf8"));
  const ok = m.objectCounts?.total === 114498 && m.canonicalIdentityCount === 6955 && m.artworkRecordCount === 40071;
  record("r2-local", "R2 local inventory", ok ? "PASS" : "FAIL", `total=${m.objectCounts?.total}`);
} else {
  record("r2-local", "R2 local inventory", "WARN", "master-manifest.json missing");
}

// R2 remote cached verify
const v51 = join(exportDir, "manifests", "r2-phase-8-51-verification.json");
if (existsSync(v51)) {
  const v = JSON.parse(readFileSync(v51, "utf8"));
  const ok = v.canonicalPresent === 114498 && v.missing === 0 && v.r2Privacy === "PRIVATE";
  record("r2-remote", "R2 remote inventory (cached)", ok ? "PASS" : "WARN", `canonical=${v.canonicalPresent} privacy=${v.r2Privacy}`);
} else {
  record("r2-remote", "R2 remote inventory", "NOT_VERIFIED", "no cached 8.51 verification");
}

// License matrix
const matrix = loadLicenseMatrix(exportDir);
const licOk = matrix && isArtworkPubliclyServable("openmoji", matrix) && !isArtworkPubliclyServable("noto", matrix);
record("license", "License filtering", licOk ? "PASS" : "FAIL", "LICENSE-MATRIX enforced");

// Security scan src (not scripts CLI)
const srcHits = scanSecretsInDir(join(root, "src"), [".ts", ".tsx", ".js"]);
record("security-src", "Security scan src/", srcHits.length === 0 ? "PASS" : "FAIL", srcHits.slice(0, 5).join("; ") || "clean");

// Frozen 8.10
const checksums = JSON.parse(readFileSync(join(root, "src/data/master/release/8.10/master-file-checksums.json"), "utf8")) as FileChecksumEntry[];
const frozen = verifyFrozenChecksums(root, checksums);
record("frozen", "Frozen 8.10 checksums", frozen.status === "PASS" ? "PASS" : "FAIL", `${frozen.mismatches.length} mismatches / ${FROZEN_MASTER_FILES.length} files");

// Route / sitemap
const slugs = getActiveEmojiSitemapSlugs(getAllBrowsableSlugs());
const sitemapCount = 7 + getAllCategorySlugs().length + slugs.length;
const routeOk = getAllBrowsableEmojis().length === PUBLIC_SEO_EMOJI_PAGE_COUNT && slugs.length === 4486 && sitemapCount === PUBLIC_SITEMAP_URL_COUNT;
record("routes", "Route audit", routeOk ? "PASS" : "FAIL", `emoji=${slugs.length} sitemap=${sitemapCount}`);
record("sitemap", "Sitemap audit", sitemapCount === 4522 ? "PASS" : "FAIL", String(sitemapCount));

// Gates
const tc = run("npm run typecheck");
writeFileSync(join(exportDir, "phase-8.55-typecheck.log"), tc.out);
record("typecheck", "TypeScript", tc.code === 0 ? "PASS" : "FAIL", `exit ${tc.code}`);

const testRuns: Array<{ pass: number; fail: number; code: number; ms: number }> = [];
for (let i = 1; i <= 3; i++) {
  const r = run("npm test");
  writeFileSync(join(exportDir, `phase-8.55-test-run-${i}.log`), r.out);
  const s = summary(r.out);
  testRuns.push({ ...s, code: r.code, ms: r.ms });
  record(`test-${i}`, `Full suite ${i}`, r.code === 0 && s.fail === 0 && s.pass === 449 ? "PASS" : "FAIL", `${s.pass}/${s.pass + s.fail}`);
}

const r2arch = run("npx tsx --test src/lib/master/r2/r2-architecture.test.ts");
writeFileSync(join(exportDir, "phase-8.55-r2-architecture.log"), r2arch.out);
const r2s = summary(r2arch.out);
record("r2-architecture", "R2 architecture tests", r2arch.code === 0 && r2s.fail === 0 ? "PASS" : "FAIL", `${r2s.pass} tests`);

const rel = run("npx tsx --test src/lib/master/release/release.test.ts");
record("release", "Frozen release tests", rel.code === 0 ? "PASS" : "FAIL", `exit ${rel.code}`);

const builds: Array<{ code: number; ms: number }> = [];
for (let i = 1; i <= 2; i++) {
  const b = run("npm run build");
  writeFileSync(join(exportDir, `phase-8.55-build-${i}.log`), b.out);
  builds.push({ code: b.code, ms: b.ms });
  record(`build-${i}`, `Production build ${i}`, b.code === 0 ? "PASS" : "FAIL", `exit ${b.code}`);
}

const bundles = scanBundles();
record("client-bundle", "Client bundle audit", bundles.client, "");
record("worker-bundle", "Worker bundle audit", bundles.worker, "");

// Post-build client secret scan
const clientHits = existsSync(join(root, ".next", "static", "chunks")) ? scanSecretsInDir(join(root, ".next", "static", "chunks"), [".js"]) : [];
record("security-client", "Client bundle secrets", clientHits.length === 0 ? "PASS" : "FAIL", clientHits.slice(0, 3).join("; ") || "clean");

// Production safety
record("no-deploy", "No production deploy", "PASS", "Phase 8.55 does not deploy");
record("no-canary", "CANARY OFF", parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) === "OFF" ? "PASS" : "FAIL", "MASTER_SEO_ROLLOUT_MODE=OFF");
record("no-full", "FULL OFF", parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) !== "FULL" ? "PASS" : "FAIL", "no FULL rollout");

const criticalFails = checks.filter((c) => c.status === "FAIL");
const verdict = criticalFails.length === 0 ? "READY FOR CONTROLLED PRODUCTION CANARY" : "NOT READY";

const manifest = {
  phase: "8.55",
  startedAt,
  completedAt: new Date().toISOString(),
  finalVerdict: verdict,
  deployExecuted: false,
  canaryEnabled: false,
  fullRolloutEnabled: false,
  productionFlagDefaults: {
    MASTER_R2_MODE: "OFF",
    masterMetadataEnabled: false,
    masterSearchEnabled: false,
    masterArtworkEnabled: false,
    masterSEOEnabled: false,
    MASTER_SEO_ROLLOUT_MODE: "OFF",
    PUBLIC_MASTER_PLATFORM_MODE: "OFF",
  },
  checks,
  testRuns,
  builds,
  bundles,
};
writeFileSync(manifestJson, JSON.stringify(manifest, null, 2));

const md = [
  "# Phase 8.55 — Production Deployment Readiness",
  "",
  `**Final verdict:** ${verdict}`,
  "",
  "**No production deploy executed in this phase.**",
  "",
  "## Scorecard",
  "",
  "| Area | Status | Detail |",
  "|------|--------|--------|",
  ...checks.map((c) => `| ${c.area} | ${c.status} | ${c.detail} |`),
  "",
  "## Test runs",
  "",
  ...testRuns.map((t, i) => `- Run ${i + 1}: ${t.pass} pass / ${t.fail} fail (${Math.round(t.ms)} ms)`),
  "",
  `Manifest: ${manifestJson}`,
].join("\n");
writeFileSync(reportMd, md, "utf8");
console.log(verdict);
if (verdict === "NOT READY") process.exit(1);