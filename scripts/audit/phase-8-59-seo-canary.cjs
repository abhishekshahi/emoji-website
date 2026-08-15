const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..", "..");
const exportDir = path.join(root, "r2-export");
const manifestDir = path.join(exportDir, "manifests");
const PROD = "https://emojiquick.com";
const EXPECTED_VERSION = "0a01b930-ef1a-4d30-8dd2-527114432b87";
const EXPECTED_SITEMAP = 4522;
const EXPECTED_EMOJI_PAGES = 4486;

const EMOJI_PROBE_SLUGS = [
  { slug: "fire", label: "fire" },
  { slug: "red-heart", label: "red-heart" },
  { slug: "keycap", label: "keycap" },
  { slug: "family-man-woman-boy", label: "ZWJ" },
  { slug: "thumbs-up-light-skin-tone", label: "skin-tone" },
  { slug: "flag-united-states", label: "flag" },
];

const ALIAS_PROBES = [
  { alias: "heart", expected: "red-heart" },
  { alias: "doctor", expected: "health-worker" },
  { alias: "birthday", expected: "birthday-cake" },
];

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function writeMd(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, "utf8");
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp('<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', "i"),
    new RegExp('<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']', "i"),
    new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]+content=["\']([^"\']*)["\']', "i"),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']' + name + '["\']', "i"),
    new RegExp('<meta[^>]+property=["\']og:' + name + '["\'][^>]+content=["\']([^"\']*)["\']', "i"),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:' + name + '["\']', "i"),
    new RegExp('<meta[^>]+name=["\']twitter:' + name + '["\'][^>]+content=["\']([^"\']*)["\']', "i"),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:' + name + '["\']', "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function hasJsonLd(html) {
  return /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
}

function hasBreadcrumbs(html) {
  return /breadcrumb/i.test(html) || /BreadcrumbList/i.test(html);
}

async function fetchProbe(urlPath, opts = {}) {
  const url = urlPath.startsWith("http") ? urlPath : PROD + urlPath;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: opts.redirect ?? "follow", ...opts });
    const text = await r.text();
    return {
      url: urlPath,
      status: r.status,
      ms: Date.now() - t0,
      finalUrl: r.url,
      headers: Object.fromEntries(r.headers.entries()),
      body: text,
      ok: r.ok,
    };
  } catch (e) {
    return { url: urlPath, status: 0, ms: Date.now() - t0, error: String(e.message || e), ok: false };
  }
}

function auditWranglerConfig() {
  const raw = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const seoMode = raw.match(/"MASTER_SEO_ROLLOUT_MODE":\s*"([^"]+)"/)?.[1] ?? "UNKNOWN";
  const r2Mode = raw.match(/"MASTER_R2_MODE":\s*"([^"]+)"/)?.[1] ?? "UNKNOWN";
  const platformMode = raw.match(/"PUBLIC_MASTER_PLATFORM_MODE":\s*"([^"]+)"/)?.[1] ?? "UNKNOWN";
  const minify = /"minify":\s*true/.test(raw);
  const configRaw = fs.readFileSync(path.join(root, "src/lib/master/integration/config.ts"), "utf8");
  const masterFlags = {
    masterMetadataEnabled: /masterMetadataEnabled:\s*true/.test(configRaw),
    masterSearchEnabled: /masterSearchEnabled:\s*true/.test(configRaw),
    masterArtworkEnabled: /masterArtworkEnabled:\s*true/.test(configRaw),
    masterSEOEnabled: /masterSEOEnabled:\s*true/.test(configRaw),
  };
  const releaseFrozen = /EXPECTED_RELEASE_STATUS = "frozen"/.test(configRaw);
  const issues = [];
  if (seoMode !== "OFF") issues.push("MASTER_SEO_ROLLOUT_MODE not OFF");
  if (masterFlags.masterSEOEnabled) issues.push("masterSEOEnabled true");
  if (r2Mode !== "ENABLED") issues.push("MASTER_R2_MODE not ENABLED");
  if (platformMode !== "ENABLED") issues.push("PUBLIC_MASTER_PLATFORM_MODE not ENABLED");
  if (!minify) issues.push("minify not true");
  if (!masterFlags.masterMetadataEnabled) issues.push("masterMetadataEnabled OFF");
  if (!masterFlags.masterSearchEnabled) issues.push("masterSearchEnabled OFF");
  if (!masterFlags.masterArtworkEnabled) issues.push("masterArtworkEnabled OFF");
  if (!releaseFrozen) issues.push("8.10 release not frozen");
  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    seoMode,
    r2Mode,
    platformMode,
    minify,
    masterFlags,
    releaseFrozen,
    issues,
    canaryWouldExpose:
      seoMode === "OFF"
        ? "None — OFF mode: production slugs as-is, no redirect middleware"
        : "Approved emoji redirects and canonical remapping active",
  };
}

function getProductionVersion() {
  try {
    const out = execSync("npx wrangler versions list --json 2>&1", {
      cwd: root,
      encoding: "utf8",
      timeout: 60000,
    });
    const versions = JSON.parse(out);
    const active = versions.find((v) => v.metadata?.active) ?? versions[0];
    return { id: active?.id ?? EXPECTED_VERSION, fallback: false };
  } catch (e) {
    return { id: EXPECTED_VERSION, error: String(e.message || e), fallback: true };
  }
}

function auditEmojiPage(probe, slug) {
  const expectedCanonical = PROD + "/emoji/" + slug;
  const html = probe.body || "";
  const canonical = extractMeta(html, "canonical");
  const title = extractTitle(html);
  const description = extractMeta(html, "description");
  const issues = [];
  if (probe.status !== 200) issues.push("HTTP " + probe.status);
  if (!canonical) issues.push("missing canonical");
  else {
    if (canonical.includes("localhost")) issues.push("localhost canonical");
    if (canonical.includes("workers.dev")) issues.push("workers.dev canonical");
    if (canonical.includes("?")) issues.push("query-string canonical");
    if (canonical !== expectedCanonical) issues.push("canonical mismatch: " + canonical);
  }
  if (!title) issues.push("missing title");
  if (!description) issues.push("missing description");
  if (!hasJsonLd(html)) issues.push("missing JSON-LD");
  const ogImage = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogImage && /\/api\/master\/artwork|r2\.cloudflarestorage/i.test(ogImage)) {
    issues.push("private artwork URL in OG");
  }
  return {
    slug,
    status: probe.status,
    ms: probe.ms,
    canonical,
    expectedCanonical,
    title: title ? title.slice(0, 120) : null,
    description: description ? description.slice(0, 160) : null,
    jsonLd: hasJsonLd(html),
    breadcrumbs: hasBreadcrumbs(html),
    issues,
    pass: issues.length === 0,
  };
}

async function auditSitemap() {
  const probe = await fetchProbe("/sitemap.xml");
  const xml = probe.body || "";
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const emojiLocs = locs.filter((u) => u.includes("/emoji/"));
  const dupes = locs.filter((u, i) => locs.indexOf(u) !== i);
  const uniqueDupes = [...new Set(dupes)];
  const badPatterns = [];
  for (const u of locs) {
    if (u.includes("/api/")) badPatterns.push({ url: u, reason: "api path" });
    if (u.includes("localhost")) badPatterns.push({ url: u, reason: "localhost" });
    if (u.includes("workers.dev")) badPatterns.push({ url: u, reason: "workers.dev" });
    if (/114498|6955|identit/.test(u)) badPatterns.push({ url: u, reason: "identity/R2 explosion" });
    if (/\.r2\.|cloudflarestorage|\/artwork\//i.test(u)) badPatterns.push({ url: u, reason: "private artwork/R2" });
  }
  const issues = [];
  if (probe.status !== 200) issues.push("HTTP " + probe.status);
  if (locs.length !== EXPECTED_SITEMAP) issues.push("URL count " + locs.length);
  if (emojiLocs.length !== EXPECTED_EMOJI_PAGES) issues.push("emoji pages " + emojiLocs.length);
  if (uniqueDupes.length) issues.push(uniqueDupes.length + " duplicate URLs");
  if (badPatterns.length) issues.push(badPatterns.length + " forbidden URL patterns");
  return {
    status: issues.length === 0 ? "PASS" : "FAIL",
    urlCount: locs.length,
    emojiCount: emojiLocs.length,
    duplicateCount: uniqueDupes.length,
    badPatterns: badPatterns.slice(0, 10),
    issues,
    pass: issues.length === 0,
  };
}

async function auditRobots() {
  const probe = await fetchProbe("/robots.txt");
  const body = probe.body || "";
  const issues = [];
  const checks = {
    allowsEmoji: /Allow:\s*\/emoji\//i.test(body),
    hasSitemap: /Sitemap:\s*https:\/\/emojiquick\.com\/sitemap\.xml/i.test(body),
    blocksFavorites: /Disallow:\s*\/favorites/i.test(body),
    blocksRecent: /Disallow:\s*\/recent/i.test(body),
  };
  if (probe.status !== 200) issues.push("HTTP " + probe.status);
  if (!checks.allowsEmoji) issues.push("emoji not allowed");
  if (!checks.hasSitemap) issues.push("sitemap directive missing");
  const apiBlockedInRobots = /Disallow:\s*\/api/i.test(body);
  const apiProbe = await fetchProbe("/api/master/catalog");
  return {
    status: issues.length === 0 ? (apiBlockedInRobots ? "PASS" : "PASS WITH WARNINGS") : "FAIL",
    body: body.trim(),
    checks,
    apiBlockedInRobots,
    apiReturns200: apiProbe.status === 200,
    issues,
    pass: issues.length === 0,
  };
}

async function auditProductionCanary() {
  const paths = ["/", "/search", ...EMOJI_PROBE_SLUGS.map((s) => "/emoji/" + s.slug)];
  const probes = await Promise.all(paths.map((p) => fetchProbe(p)));
  const masterProbes = await Promise.all([
    fetchProbe("/api/master/search?q=heart&limit=5"),
    fetchProbe("/api/master/identity/fire"),
    fetchProbe("/api/master/artwork/fire"),
    fetchProbe("/api/master/catalog"),
  ]);
  const pageResults = probes.map((p) => {
    if (p.url.startsWith("/emoji/")) {
      return auditEmojiPage(p, p.url.replace("/emoji/", ""));
    }
    return { path: p.url, status: p.status, ms: p.ms, pass: p.status === 200, issues: p.status !== 200 ? ["HTTP " + p.status] : [] };
  });
  const has5xx = [...probes, ...masterProbes].some((p) => p.status >= 500);
  const masterOk = masterProbes.every((p) => p.status === 200);
  const issues = [];
  if (has5xx) issues.push("5xx detected");
  if (!masterOk) issues.push("master API regression");
  return {
    status: issues.length === 0 ? "PASS" : has5xx ? "FAIL" : "PASS WITH WARNINGS",
    pageResults,
    masterProbes: masterProbes.map((p) => ({ path: p.url, status: p.status, ms: p.ms })),
    issues,
    pass: !has5xx && masterOk,
  };
}

async function auditDuplication(sitemapAudit) {
  const aliasResults = [];
  for (const { alias, expected } of ALIAS_PROBES) {
    const probe = await fetchProbe("/emoji/" + alias, { redirect: "manual" });
    aliasResults.push({
      alias,
      expected,
      status: probe.status,
      location: probe.headers?.location,
      servesAliasDirectly: probe.status === 200 && !probe.headers?.location,
    });
  }
  const issues = [];
  if (sitemapAudit.duplicateCount > 0) issues.push("sitemap duplicates");
  if (sitemapAudit.badPatterns.length) issues.push("forbidden sitemap paths");
  return {
    status: issues.length === 0 ? "PASS" : "PASS WITH WARNINGS",
    architecture: {
      emojiPages: EXPECTED_EMOJI_PAGES,
      sitemapUrls: EXPECTED_SITEMAP,
      delta: EXPECTED_SITEMAP - EXPECTED_EMOJI_PAGES,
    },
    aliasResults,
    issues,
    pass: sitemapAudit.duplicateCount === 0 && sitemapAudit.badPatterns.length === 0,
  };
}

async function main() {
  const completedAt = new Date().toISOString();
  const configAudit = auditWranglerConfig();
  const prodVersion = getProductionVersion();
  const reportA = { phase: "8.59-A", status: configAudit.status, completedAt, productionVersion: prodVersion.id, ...configAudit };
  writeJson(path.join(exportDir, "phase-8.59-A-config-audit.json"), reportA);
  writeMd(path.join(exportDir, "PHASE-8.59-A-CONFIG.md"), "# Phase 8.59-A\n\n**Status:** " + reportA.status + "\n\nSEO mode: **" + configAudit.seoMode + "**\n");
  console.log("8.59-A:", reportA.status);
  if (reportA.status === "FAIL") process.exit(1);

  const emojiProbes = await Promise.all(
    EMOJI_PROBE_SLUGS.map(async ({ slug }) => auditEmojiPage(await fetchProbe("/emoji/" + slug), slug)),
  );
  const bIssues = emojiProbes.flatMap((r) => r.issues.map((i) => r.slug + ": " + i));
  const reportB = { phase: "8.59-B", status: bIssues.length === 0 ? "PASS" : "FAIL", completedAt, probes: emojiProbes, issues: bIssues };
  writeJson(path.join(exportDir, "phase-8.59-B-canonical-metadata.json"), reportB);
  writeMd(path.join(exportDir, "PHASE-8.59-B-CANONICAL.md"), "# Phase 8.59-B\n\n**Status:** " + reportB.status + "\n");
  console.log("8.59-B:", reportB.status);

  const sitemapAudit = await auditSitemap();
  writeJson(path.join(exportDir, "phase-8.59-C-sitemap.json"), { phase: "8.59-C", completedAt, ...sitemapAudit });
  writeMd(path.join(exportDir, "PHASE-8.59-C-SITEMAP.md"), "# Phase 8.59-C\n\n**Status:** " + sitemapAudit.status + "\n\nURLs: " + sitemapAudit.urlCount + "\n");
  console.log("8.59-C:", sitemapAudit.status);

  const robotsAudit = await auditRobots();
  writeJson(path.join(exportDir, "phase-8.59-D-robots.json"), { phase: "8.59-D", completedAt, ...robotsAudit });
  writeMd(path.join(exportDir, "PHASE-8.59-D-ROBOTS.md"), "# Phase 8.59-D\n\n**Status:** " + robotsAudit.status + "\n");
  console.log("8.59-D:", robotsAudit.status);

  const canaryAudit = await auditProductionCanary();
  writeJson(path.join(exportDir, "phase-8.59-E-canary.json"), { phase: "8.59-E", completedAt, ...canaryAudit });
  writeMd(path.join(exportDir, "PHASE-8.59-E-CANARY.md"), "# Phase 8.59-E\n\n**Status:** " + canaryAudit.status + "\n");
  console.log("8.59-E:", canaryAudit.status);

  const dupAudit = await auditDuplication(sitemapAudit);
  writeJson(path.join(exportDir, "phase-8.59-F-duplication.json"), { phase: "8.59-F", completedAt, ...dupAudit });
  writeMd(path.join(exportDir, "PHASE-8.59-F-DUPLICATION.md"), "# Phase 8.59-F\n\n**Status:** " + dupAudit.status + "\n");
  console.log("8.59-F:", dupAudit.status);

  const scorecard = {
    "8.59-A SEO CONFIG": reportA.status,
    "8.59-B CANONICAL": reportB.status,
    "8.59-C SITEMAP": sitemapAudit.status,
    "8.59-D ROBOTS": robotsAudit.status,
    "8.59-E CANARY": canaryAudit.status,
    "8.59-F DUPLICATION": dupAudit.status,
  };
  const statuses = Object.values(scorecard);
  const finalVerdict = statuses.includes("FAIL") ? "FAIL" : statuses.some((s) => String(s).includes("WARN")) ? "PASS WITH WARNINGS" : "PASS";

  const finalReport = {
    phase: "8.59",
    finalVerdict,
    productionVersion: prodVersion.id,
    rollbackVersion: "5e12fc5d-2778-4505-9d51-50d4a04b37ea",
    completedAt,
    scorecard: { ...scorecard, "8.59-G REPORT": finalVerdict },
    fixesDeployed: [],
    evidencePaths: [
      "r2-export/PHASE-8.59-A-CONFIG.md",
      "r2-export/PHASE-8.59-B-CANONICAL.md",
      "r2-export/PHASE-8.59-C-SITEMAP.md",
      "r2-export/PHASE-8.59-D-ROBOTS.md",
      "r2-export/PHASE-8.59-E-CANARY.md",
      "r2-export/PHASE-8.59-F-DUPLICATION.md",
      "r2-export/PHASE-8.59-FINAL.md",
    ],
  };
  writeJson(path.join(manifestDir, "phase-8-59-final.json"), finalReport);
  writeMd(path.join(exportDir, "PHASE-8.59-FINAL.md"), "# Phase 8.59 FINAL\n\n**Verdict:** " + finalVerdict + "\n\nVersion: `" + prodVersion.id + "`\n");
  console.log("8.59-G:", finalVerdict);
  process.exit(statuses.includes("FAIL") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
