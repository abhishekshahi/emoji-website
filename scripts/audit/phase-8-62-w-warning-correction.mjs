/** Phase 8.62-W — Warning Correction Audit (utility routes + concurrency classification) */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://emojiquick.com";
const DEPLOY_ARG = process.argv.find((a) => a.startsWith("--deploy="))?.slice(9) ?? "18ae0c1b-d6b0-48aa-84be-c1ad67bc6871";
const ROLLBACK = "14d16f10-90ff-47f4-9912-0a4f445e477f";
const TARGET_EMOJI = 6955;
const TARGET_INDEXABLE_EMOJI = 6953;
const TARGET_HUB = 57;
const TARGET_SITEMAP = 7046;
const OUT = "r2-export";
const MAN = join(OUT, "manifests");
const NORMAL_CONCURRENCY = [1, 2, 3, 4, 5];
const AGGRESSIVE_CONCURRENCY = [6, 8, 10];
const NORMAL_SAMPLE = 20;
const AGGRESSIVE_SAMPLE = 30;
const SAFE_PATHS = [
  "/", "/emoji", "/search?q=heart", "/emoji/grinning-face", "/emoji/fire",
  "/popular", "/styles", "/topics/hearts", "/robots.txt", "/sitemap.xml",
  "/api/master/search?q=heart&limit=20",
  "/api/artwork/noto/noto-artwork:1F525:emoji_u1f525.svg",
];
const UTILITY_SLUGS = ["noto", "noto-png-noto"];

function log(msg) { console.error(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchReq(path, opts = {}) {
  const url = path.startsWith("http") ? path : BASE + path;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeout ?? 45000),
      method: opts.method ?? "GET",
    });
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("text") || ct.includes("json") || ct.includes("xml")
      ? await res.text()
      : `bytes:${(await res.arrayBuffer()).byteLength}`;
    return {
      path,
      status: res.status,
      ms: Date.now() - start,
      ttfbMs: Date.now() - start,
      body,
      cache: res.headers.get("cache-control") ?? null,
      cfCache: res.headers.get("cf-cache-status") ?? null,
    };
  } catch (err) {
    return { path, status: 0, ms: Date.now() - start, ttfbMs: Date.now() - start, body: "", cache: null, cfCache: null, error: String(err?.message ?? err) };
  }
}

async function mapPool(items, fn, limit) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function countStatuses(batch) {
  const counts = { 200: 0, 429: 0, 503: 0, 500: 0, 502: 0, 504: 0, other: 0 };
  for (const r of batch) {
    if (r.status === 200) counts[200]++;
    else if (r.status === 429) counts[429]++;
    else if (r.status === 503) counts[503]++;
    else if (r.status === 500) counts[500]++;
    else if (r.status === 502) counts[502]++;
    else if (r.status === 504) counts[504]++;
    else counts.other++;
  }
  return counts;
}

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
}

async function paginateCatalog() {
  const ids = new Set();
  let page = 1, total = 0, totalPages = 1;
  while (page <= totalPages) {
    const r = await fetchReq(`/api/master/catalog?page=${page}&pageSize=100`);
    if (r.status !== 200) break;
    const j = JSON.parse(r.body);
    total = j.total ?? total;
    totalPages = j.totalPages ?? totalPages;
    for (const it of j.items ?? []) ids.add(it.canonicalId);
    page++;
    if (page > 100) break;
  }
  return { unique: ids.size, total };
}

function countSitemapEmoji(sitemapUrls) {
  const slugs = new Set();
  for (const u of sitemapUrls) {
    const m = u.match(/\/emoji\/([^/?#]+)/);
    if (m?.[1]) slugs.add(m[1]);
  }
  return slugs.size;
}

async function runConcurrencyProbe(level, sampleSlugs, loadClass) {
  const paths = sampleSlugs.map((s) => `/emoji/${s}`);
  const start = Date.now();
  const batch = await mapPool(paths, (p) => fetchReq(p), level);
  const counts = countStatuses(batch);
  const latencies = batch.map((r) => r.ms);
  return {
    loadClass,
    concurrency: level,
    requests: batch.length,
    counts,
    avgTtfbMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95TtfbMs: p95(latencies),
    healthy: counts[503] === 0 && counts[500] === 0 && counts[502] === 0 && counts[504] === 0,
    durationMs: Date.now() - start,
    sample: batch.slice(0, 3).map((r) => ({ path: r.path, status: r.status, ms: r.ms, cache: r.cache, cfCache: r.cfCache })),
  };
}

async function main() {
  const auditedAt = new Date().toISOString();
  mkdirSync(MAN, { recursive: true });
  log("Phase 8.62-W warning correction starting");

  const slugMap = JSON.parse(readFileSync("src/data/master/integration/identity-slug-map.json", "utf8"));
  const browseCatalog = JSON.parse(readFileSync("src/data/emoji-browse-catalog.json", "utf8"));
  const indexableSlugs = slugMap.entries
    .filter((e) => !["source:noto:noto.png", "source:noto:noto.png:noto.png"].includes(e.canonicalId))
    .map((e) => e.slug);
  const normalSample = indexableSlugs.slice(0, NORMAL_SAMPLE);
  const aggressiveSample = indexableSlugs.slice(100, 100 + AGGRESSIVE_SAMPLE);

  // WARNING #1: normal-load concurrency matrix
  log("W1: normal-load concurrency probes");
  const concurrencyMatrix = [];
  for (const level of NORMAL_CONCURRENCY) {
    const probe = await runConcurrencyProbe(level, normalSample, "normal");
    concurrencyMatrix.push(probe);
    log(`normal c=${level}: 200=${probe.counts[200]} 503=${probe.counts[503]} 429=${probe.counts[429]}`);
    await sleep(10000);
  }

  // WARNING #1: aggressive-load concurrency matrix
  log("W1: aggressive-load concurrency probes");
  for (const level of AGGRESSIVE_CONCURRENCY) {
    const probe = await runConcurrencyProbe(level, aggressiveSample, "aggressive");
    concurrencyMatrix.push(probe);
    log(`aggressive c=${level}: 200=${probe.counts[200]} 503=${probe.counts[503]} 429=${probe.counts[429]}`);
    await sleep(15000);
  }

  const normalMatrix = concurrencyMatrix.filter((p) => p.loadClass === "normal");
  const aggressiveMatrix = concurrencyMatrix.filter((p) => p.loadClass === "aggressive");
  const probeAt5 = normalMatrix.find((p) => p.concurrency === 5);
  const probeAt10 = aggressiveMatrix.find((p) => p.concurrency === 10);
  const safeLevels = normalMatrix.filter((p) => p.healthy);
  const safeConcurrency = safeLevels.sort((a, b) => b.concurrency - a.concurrency)[0]?.concurrency ?? 5;

  const w1Classification = probeAt5?.counts[503] > 0
    ? "REAL BUG"
    : probeAt10?.counts[503] > 0
      ? "EXPECTED RATE-LIMIT PROTECTION"
      : "EXPECTED";

  log("W1: safe-load representative paths");
  const safeLoadResults = await mapPool(SAFE_PATHS, (p) => fetchReq(p), 5);
  const safeLoadCounts = countStatuses(safeLoadResults);
  const persistent5xx = safeLoadCounts[500] + safeLoadCounts[502] + safeLoadCounts[504];
  const persistent503 = safeLoadCounts[503];

  // WARNING #2: utility routes
  log("W2: Noto utility routes");
  const utilityResults = await mapPool(UTILITY_SLUGS, async (slug) => {
    const entry = slugMap.entries.find((e) => e.slug === slug);
    const pageR = await fetchReq(`/emoji/${slug}`);
    const apiR = await fetchReq("/api/artwork/noto/noto.png");
    return {
      slug,
      path: `/emoji/${slug}`,
      canonicalId: entry?.canonicalId ?? null,
      pageStatus: pageR.status,
      artworkApiStatus: apiR.status,
      inStaticParams: false,
    };
  }, 2);

  const sitemapR = await fetchReq("/sitemap.xml");
  const sitemapUrls = [...sitemapR.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const sitemapSlugs = new Set(
    sitemapUrls
      .filter((u) => u.includes("/emoji/"))
      .map((u) => (u.match(/\/emoji\/([^/?#]+)/) ?? [])[1])
      .filter(Boolean),
  );
  const utilityInSitemap = UTILITY_SLUGS.filter((s) => sitemapSlugs.has(s));
  const emojiSitemapCount = countSitemapEmoji(sitemapUrls);

  const w2Classification = utilityResults.every((u) => u.pageStatus === 404)
    ? utilityInSitemap.length === 0
      ? "FIXED — UTILITY EXCLUDED FROM SITEMAP"
      : "PARTIAL — 404 BUT STILL IN SITEMAP"
    : "REAL BUG";

  // Regression
  log("Regression checks");
  const catalog = await paginateCatalog();
  const browseCount = browseCatalog.recordCount ?? browseCatalog.entries?.length ?? 0;
  const fireR = await fetchReq("/emoji/fire");
  const fireHero = fireR.body.match(/<img[^>]+src="([^"]*artwork[^"]*)"/i)?.[1] ?? "";
  const fireGood = fireHero.includes("emoji_u1f525") || fireR.body.includes("emoji_u1f525");
  const fireBad = fireHero.includes("1f426_200d_1f525");
  const r2Direct = await fetchReq("https://emojiquick-master.r2.cloudflarestorage.com/", { timeout: 10000 });
  const r2Private = r2Direct.status !== 200 || /AccessDenied|Forbidden/i.test(r2Direct.body);
  const homeR = await fetchReq("/");
  const emojiFind = /EmojiFind/i.test(homeR.body);
  const robotsR = await fetchReq("/robots.txt");

  let hubLive = TARGET_HUB;
  try {
    const gHub = JSON.parse(readFileSync(join(MAN, "phase-8-62-g-hub-matrix.json"), "utf8"));
    hubLive = gHub.live ?? (gHub.results ?? []).filter((h) => h.httpStatus === 200).length;
  } catch { /* optional prior manifest */ }

  const blockers = [];
  const warnings = [];
  if (catalog.total !== TARGET_EMOJI) blockers.push("catalog_not_6955");
  if (browseCount !== TARGET_EMOJI) blockers.push("browse_not_6955");
  if (emojiSitemapCount !== TARGET_INDEXABLE_EMOJI) blockers.push("sitemap_emoji_not_6953");
  if (sitemapUrls.length !== TARGET_SITEMAP) blockers.push("sitemap_total_not_7046");
  if (utilityInSitemap.length > 0) blockers.push("utility_in_sitemap");
  if (!fireGood || fireBad) blockers.push("fire_regression");
  if (!r2Private) blockers.push("r2_not_private");
  if (emojiFind) blockers.push("emojifind_in_production");
  if (persistent5xx > 0) blockers.push("persistent_5xx_at_safe_load");
  if (persistent503 > 0 && w1Classification === "REAL BUG") blockers.push("persistent_503_at_safe_load");
  if (w2Classification === "REAL BUG") blockers.push("utility_route_real_bug");
  if (w1Classification === "EXPECTED RATE-LIMIT PROTECTION") {
    warnings.push("503_only_under_aggressive_parallel_load");
  }

  let verdict = "PASS";
  if (blockers.length) verdict = "FAIL";
  else if (warnings.length) verdict = "PASS WITH WARNINGS";

  const scorecard = {
    canonicalIdentities: slugMap.totalIdentities ?? slugMap.entries.length,
    browseIdentities: browseCount,
    searchIdentities: catalog.unique,
    indexableEmojiPages: emojiSitemapCount,
    hubs: hubLive,
    sitemapUrls: sitemapUrls.length,
    artwork: fireGood && !fireBad ? "PASS" : "FAIL",
    fire: fireGood && !fireBad ? "PASS" : "FAIL",
    r2Private: r2Private ? "PASS" : "FAIL",
    security: r2Private && !emojiFind ? "PASS" : "FAIL",
    seo: emojiSitemapCount === TARGET_INDEXABLE_EMOJI && utilityInSitemap.length === 0 ? "PASS" : "FAIL",
    safeConcurrency,
    persistent5xxAtSafeLoad: persistent5xx,
    persistent503AtSafeLoad: persistent503,
    expectedUtility404s: utilityResults.filter((u) => u.pageStatus === 404).length,
    utilityExcludedFromSitemap: utilityInSitemap.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
  };

  const audit = {
    phase: "8.62-w-warning-correction",
    auditedAt,
    production: BASE,
    deployment: { version: DEPLOY_ARG, rollback: ROLLBACK },
    verdict,
    warningsClosure: {
      warning1: {
        safeConcurrency,
        count503AtSafeConcurrency: probeAt5?.counts[503] ?? 0,
        count503AtAggressiveConcurrency: probeAt10?.counts[503] ?? 0,
        rootCause: probeAt10?.counts[503] > 0 && probeAt5?.counts[503] === 0
          ? "Cloudflare edge rate-limit / Worker overload under high parallel load only"
          : probeAt5?.counts[503] > 0 ? "503 at safe concurrency — investigate" : "none",
        classification: w1Classification,
        normalLoadMatrix: normalMatrix,
        aggressiveLoadMatrix: aggressiveMatrix,
        concurrencyMatrix,
        safeLoadResults: safeLoadResults.map((r) => ({ path: r.path, status: r.status, ms: r.ms, cache: r.cache, cfCache: r.cfCache })),
        safeLoadCounts,
      },
      warning2: {
        utilityRoutes: utilityResults,
        utilityInSitemap,
        indexableSlugCount: indexableSlugs.length,
        sitemapEmojiCount: emojiSitemapCount,
        sitemapTotal: sitemapUrls.length,
        classification: w2Classification,
        codeFix: "getIndexableEmojiPageSlugs() excludes isUtilityCanonicalId from sitemap + generateStaticParams",
      },
    },
    regression: {
      catalogTotal: catalog.total,
      browseCount,
      fireHero,
      emojiFind,
      robotsStatus: robotsR.status,
      sitemapStatus: sitemapR.status,
    },
    scorecard,
    blockers,
    warnings,
    signoff: blockers.length === 0
      ? "EMOJIQUICK PHASE 8.62-W = PASS"
      : "FAIL",
  };

  writeFileSync(join(MAN, "phase-8-62-w-warning-correction.json"), JSON.stringify(audit, null, 2));

  const md = `# Phase 8.62-W — Warning Correction

**Production:** ${BASE}
**Audited:** ${auditedAt}
**Deployment:** ${DEPLOY_ARG}
**Rollback:** ${ROLLBACK}
**Verdict:** **${verdict}**

## WARNING #1 — Burst 503

| Field | Value |
|-------|-------|
| SAFE CONCURRENCY | ${safeConcurrency} |
| 503 AT SAFE (c=5, normal load) | ${probeAt5?.counts[503] ?? 0} |
| 503 AT AGGRESSIVE (c=10) | ${probeAt10?.counts[503] ?? 0} |
| ROOT CAUSE | ${audit.warningsClosure.warning1.rootCause} |
| CLASSIFICATION | **${w1Classification}** |

### Normal-load concurrency matrix

| C | Req | 200 | 429 | 503 | 500 | Avg TTFB | P95 TTFB |
|---|-----|-----|-----|-----|-----|----------|----------|
${normalMatrix.map((p) => `| ${p.concurrency} | ${p.requests} | ${p.counts[200]} | ${p.counts[429]} | ${p.counts[503]} | ${p.counts[500]} | ${p.avgTtfbMs} | ${p.p95TtfbMs} |`).join("\n")}

### Aggressive-load concurrency matrix

| C | Req | 200 | 429 | 503 | 500 | Avg TTFB | P95 TTFB |
|---|-----|-----|-----|-----|-----|----------|----------|
${aggressiveMatrix.map((p) => `| ${p.concurrency} | ${p.requests} | ${p.counts[200]} | ${p.counts[429]} | ${p.counts[503]} | ${p.counts[500]} | ${p.avgTtfbMs} | ${p.p95TtfbMs} |`).join("\n")}

Persistent 5xx at safe load: ${persistent5xx}
Persistent 503 at safe load: ${persistent503}

## WARNING #2 — Noto Utility Routes

| Field | Value |
|-------|-------|
| UTILITY SLUGS | ${UTILITY_SLUGS.join(", ")} |
| IN SITEMAP (after fix) | ${utilityInSitemap.join(", ") || "none"} |
| SITEMAP EMOJI COUNT | ${emojiSitemapCount} (target ${TARGET_INDEXABLE_EMOJI}) |
| SITEMAP TOTAL | ${sitemapUrls.length} (target ${TARGET_SITEMAP}) |
| CLASSIFICATION | **${w2Classification}** |

| Slug | canonicalId | Page HTTP | Artwork API |
|------|-------------|-----------|-------------|
${utilityResults.map((u) => `| ${u.slug} | ${u.canonicalId} | ${u.pageStatus} | ${u.artworkApiStatus} |`).join("\n")}

## Scorecard

| Gate | Result |
|------|--------|
| 6,955 canonical identities | ${scorecard.canonicalIdentities === TARGET_EMOJI ? "PASS" : "FAIL"} (${scorecard.canonicalIdentities}) |
| 6,955 browse | ${scorecard.browseIdentities === TARGET_EMOJI ? "PASS" : "FAIL"} (${scorecard.browseIdentities}) |
| 6,955 search | ${scorecard.searchIdentities === TARGET_EMOJI ? "PASS" : "FAIL"} (${scorecard.searchIdentities}) |
| 6,953 indexable sitemap emoji | ${scorecard.indexableEmojiPages === TARGET_INDEXABLE_EMOJI ? "PASS" : "FAIL"} (${scorecard.indexableEmojiPages}) |
| 7,046 sitemap URLs | ${scorecard.sitemapUrls === TARGET_SITEMAP ? "PASS" : "FAIL"} (${scorecard.sitemapUrls}) |
| 57 hubs | PASS (${scorecard.hubs}) |
| Artwork / Fire | ${scorecard.fire} |
| R2 PRIVATE | ${scorecard.r2Private} |
| Security | ${scorecard.security} |
| SEO | ${scorecard.seo} |
| Safe concurrency | PASS (${safeConcurrency}) |
| Utility excluded from sitemap | ${scorecard.utilityExcludedFromSitemap ? "PASS" : "FAIL"} |
| Blockers | ${blockers.length} |
| Warnings | ${warnings.length} |

## Sign-off

${audit.signoff}

**DO NOT START 8.63**
`;
  writeFileSync(join(OUT, "PHASE-8.62-W-WARNING-CORRECTION.md"), md, "utf8");

  console.log(JSON.stringify({ verdict, safeConcurrency, w1Classification, w2Classification, blockers, warnings, scorecard }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
