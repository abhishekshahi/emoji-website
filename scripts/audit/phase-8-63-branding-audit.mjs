/** Phase 8.63 — Official EmojiQuick branding audit */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://emojiquick.com";
const DEPLOY_ARG = process.argv.find((a) => a.startsWith("--deploy="))?.slice(9) ?? "pending";
const ROLLBACK = "e5c9d91d-1c4b-44b3-b061-0401fef5bda2";
const OUT = "r2-export";
const MAN = join(OUT, "manifests");
const BRAND_ASSETS = [
  "/brand/emojiquick-logo-primary.png",
  "/brand/emojiquick-icon.png",
  "/brand/emojiquick-og.png",
  "/brand/favicon-32.png",
  "/brand/favicon-180.png",
  "/brand/favicon-512.png",
];
const PAGES = ["/", "/emoji", "/search?q=heart", "/emoji/fire", "/popular", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchReq(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(45000) });
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("text") || ct.includes("json") || ct.includes("xml") || ct.includes("manifest")
      ? await res.text()
      : `bytes:${(await res.arrayBuffer()).byteLength}`;
    return { path, status: res.status, ms: Date.now() - start, body, ct };
  } catch (err) {
    return { path, status: 0, ms: Date.now() - start, body: "", ct: "", error: String(err?.message ?? err) };
  }
}

function userFacingEmojiFind(html) {
  return />[^<]*EmojiFind[^<]*</i.test(html) || /aria-label=["'][^"']*EmojiFind/i.test(html) || /alt=["'][^"']*EmojiFind/i.test(html);
}

function hasEmojiQuick(html) { return /EmojiQuick/i.test(html); }

function extractLogoRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/(?:src|href)=["']([^"']*(?:brand|icon|favicon|logo)[^"']*)["']/gi)) refs.push(m[1]);
  return [...new Set(refs)];
}

async function paginateCatalog() {
  let total = 0;
  for (let page = 1; page <= 3; page++) {
    const r = await fetchReq(`/api/master/catalog?page=${page}&pageSize=100`);
    if (r.status !== 200) break;
    const j = JSON.parse(r.body);
    total = j.total ?? total;
  }
  return total;
}

async function main() {
  const auditedAt = new Date().toISOString();
  mkdirSync(MAN, { recursive: true });

  const brandAssetResults = [];
  for (const asset of BRAND_ASSETS) {
    const r = await fetchReq(asset);
    brandAssetResults.push({ asset, status: r.status, contentType: r.ct, ms: r.ms });
    await sleep(200);
  }

  const pageResults = [];
  for (const path of PAGES) {
    const r = await fetchReq(path);
    const emojiFind = userFacingEmojiFind(r.body);
    const emojiQuick = hasEmojiQuick(r.body);
    const logoRefs = extractLogoRefs(r.body);
    pageResults.push({ path, status: r.status, emojiQuick, emojiFind, logoRefs: logoRefs.slice(0, 8) });
    await sleep(300);
  }

  const home = pageResults.find((p) => p.path === "/") ?? pageResults[0];
  const manifestR = pageResults.find((p) => p.path === "/manifest.webmanifest");
  const sitemapR = await fetchReq("/sitemap.xml");
  const sitemapUrls = [...sitemapR.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const emojiSitemap = sitemapUrls.filter((u) => u.includes("/emoji/")).length;
  const catalogTotal = await paginateCatalog();
  const browseData = JSON.parse(readFileSync("src/data/emoji-browse-catalog.json", "utf8"));
  const fireR = await fetchReq("/emoji/fire");
  const fireHero = fireR.body.match(/<img[^>]+src="([^"]*artwork[^"]*)"/i)?.[1] ?? "";
  const fireGood = fireHero.includes("emoji_u1f525") || fireR.body.includes("emoji_u1f525");
  const fireBad = fireHero.includes("1f426_200d_1f525");
  const r2Direct = await fetchReq("https://emojiquick-master.r2.cloudflarestorage.com/", { timeout: 10000 });
  const r2Private = r2Direct.status !== 200;

  const jsonLdMatch = home?.logoRefs?.length ? true : /application\/ld\+json/i.test((await fetchReq("/")).body);
  const homeHtml = (await fetchReq("/")).body;
  const hasOrgJsonLd = /"@type"\s*:\s*"Organization"/.test(homeHtml) && /emojiquick-logo-primary\.png/.test(homeHtml);
  const usesNewLogo = /emojiquick-logo-primary\.png|emojiquick-icon\.png/.test(homeHtml);
  const usesOldSvgOnly = /emojiquick-logo-primary\.svg/.test(homeHtml) && !usesNewLogo;

  const blockers = [];
  const warnings = [];
  if (brandAssetResults.some((a) => a.status !== 200)) blockers.push("brand_asset_missing");
  if (pageResults.some((p) => p.emojiFind)) blockers.push("emojifind_user_facing");
  if (!pageResults.every((p) => p.emojiQuick || p.path.includes("robots") || p.path.includes("manifest"))) {
    if (!home?.emojiQuick) blockers.push("missing_emojiquick_home");
  }
  if (usesOldSvgOnly) blockers.push("old_svg_logo_active");
  if (!usesNewLogo) blockers.push("new_logo_not_in_header");
  if (!hasOrgJsonLd) warnings.push("org_jsonld_not_detected");
  if (catalogTotal !== 6955) blockers.push("catalog_regression");
  if ((browseData.recordCount ?? 0) !== 6955) blockers.push("browse_regression");
  if (emojiSitemap !== 6953) blockers.push("sitemap_emoji_regression");
  if (sitemapUrls.length !== 7046) blockers.push("sitemap_total_regression");
  if (!fireGood || fireBad) blockers.push("fire_regression");
  if (!r2Private) blockers.push("r2_not_private");

  let verdict = blockers.length ? "FAIL" : warnings.length ? "PASS WITH WARNINGS" : "PASS";

  const audit = {
    phase: "8.63-branding",
    auditedAt,
    production: BASE,
    deployment: { version: DEPLOY_ARG, rollback: ROLLBACK },
    verdict,
    branding: {
      brandAssets: brandAssetResults,
      pages: pageResults,
      usesNewLogo,
      usesOldSvgOnly,
      hasOrgJsonLd,
      emojiFindUserFacing: pageResults.filter((p) => p.emojiFind).map((p) => p.path),
      emojiQuickPresent: pageResults.filter((p) => p.emojiQuick).map((p) => p.path),
    },
    regression: {
      catalogTotal,
      browseCount: browseData.recordCount,
      sitemapTotal: sitemapUrls.length,
      sitemapEmoji: emojiSitemap,
      fire: fireGood && !fireBad ? "PASS" : "FAIL",
      r2Private: r2Private ? "PASS" : "FAIL",
    },
    blockers,
    warnings,
    signoff: blockers.length === 0 ? "EMOJIQUICK PHASE 8.63 = PASS" : "FAIL",
  };

  writeFileSync(join(MAN, "phase-8-63-branding.json"), JSON.stringify(audit, null, 2));

  const md = `# Phase 8.63 — Official EmojiQuick Branding

**Production:** ${BASE}
**Audited:** ${auditedAt}
**Deployment:** ${DEPLOY_ARG}
**Rollback:** ${ROLLBACK}
**Verdict:** **${verdict}**

## Brand asset delivery

| Asset | HTTP |
|-------|------|
${brandAssetResults.map((a) => `| ${a.asset} | ${a.status} |`).join("\n")}

## User-facing branding scan

| Page | EmojiQuick | EmojiFind | Logo refs |
|------|------------|-----------|-----------|
${pageResults.map((p) => `| ${p.path} | ${p.emojiQuick ? "yes" : "no"} | ${p.emojiFind ? "YES" : "no"} | ${(p.logoRefs ?? []).join(", ") || "—"} |`).join("\n")}

## Regression (Phase 8.62 preserved)

| Metric | Result | Target |
|--------|--------|--------|
| Catalog | ${catalogTotal} | 6955 |
| Browse | ${browseData.recordCount} | 6955 |
| Sitemap emoji | ${emojiSitemap} | 6953 |
| Sitemap total | ${sitemapUrls.length} | 7046 |
| Fire | ${audit.regression.fire} | PASS |
| R2 | ${audit.regression.r2Private} | PRIVATE |

## Sign-off

${audit.signoff}

**DO NOT START 8.64**
`;
  writeFileSync(join(OUT, "PHASE-8.63-BRANDING.md"), md, "utf8");
  console.log(JSON.stringify({ verdict, blockers, warnings, usesNewLogo, emojiFind: audit.branding.emojiFindUserFacing }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });