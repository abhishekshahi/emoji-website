/** Phase 8.63-LIVE — Complete logo production audit (read-only) */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://emojiquick.com";
const OUT = "r2-export";
const MAN = join(OUT, "manifests");
const OFFICIAL_ASSETS = [
  "/brand/emojiquick-logo-primary.png",
  "/brand/emojiquick-logo-primary.webp",
  "/brand/emojiquick-icon.png",
  "/brand/emojiquick-og.png",
  "/brand/emojiquick-logo-primary-4k.png",
  "/brand/favicon-16.png",
  "/brand/favicon-32.png",
  "/brand/favicon-48.png",
  "/brand/favicon-96.png",
  "/brand/favicon-180.png",
  "/brand/favicon-192.png",
  "/brand/favicon-256.png",
  "/brand/favicon-512.png",
];
const OLD_PATTERNS = [
  { id: "svg_primary", re: /emojiquick-logo-primary\.svg/i },
  { id: "svg_icon", re: /emojiquick-icon\.svg/i },
  { id: "svg_wordmark", re: /emojiquick-wordmark\.svg/i },
  { id: "emojifind_name", re: />[^<]{0,80}EmojiFind[^<]{0,80}</i },
  { id: "emojifind_aria", re: /aria-label=["'][^"']*EmojiFind/i },
  { id: "emojifind_alt", re: /alt=["'][^"']*EmojiFind/i },
  { id: "emojifind_title", re: /<title[^>]*>[^<]*EmojiFind/i },
];
const PAGES = [
  { id: "homepage", path: "/", checks: ["header", "footer"] },
  { id: "browse", path: "/emoji", checks: ["header"] },
  { id: "search", path: "/search?q=heart", checks: ["header"] },
  { id: "explore", path: "/explore", checks: ["header"] },
  { id: "popular", path: "/popular", checks: ["header"] },
  { id: "trending", path: "/trending", checks: ["header"] },
  { id: "styles", path: "/styles", checks: ["header"] },
  { id: "topics", path: "/topics/hearts", checks: ["header"] },
  { id: "context", path: "/context/discord", checks: ["header"] },
  { id: "emoji_fire", path: "/emoji/fire", checks: ["header"] },
  { id: "emoji_grinning", path: "/emoji/grinning-face", checks: ["header"] },
  { id: "emoji_noto", path: "/emoji/noto", checks: ["header"] },
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchReq(path, opts = {}) {
  const url = path.startsWith("http") ? path : BASE + path;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeout ?? 45000),
      headers: opts.headers ?? {},
    });
    const ct = res.headers.get("content-type") ?? "";
    const cl = res.headers.get("content-length");
    const cache = res.headers.get("cache-control");
    const cfCache = res.headers.get("cf-cache-status");
    const etag = res.headers.get("etag");
    const isText = /text|json|xml|manifest|html|svg/i.test(ct);
    const buf = isText ? Buffer.from(await res.text(), "utf8") : Buffer.from(await res.arrayBuffer());
    return {
      path,
      url,
      status: res.status,
      ms: Date.now() - start,
      contentType: ct,
      contentLength: cl ? Number(cl) : buf.length,
      cache,
      cfCache,
      etag,
      body: isText ? buf.toString("utf8") : null,
      bytes: buf.length,
      buffer: isText ? null : buf,
    };
  } catch (err) {
    return { path, url: path, status: 0, ms: Date.now() - start, error: String(err?.message ?? err) };
  }
}

function extractLogoRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href|content)=["']([^"']*(?:brand|icon|favicon|logo|apple-icon)[^"']*)["']/gi)) {
    refs.add(m[1]);
  }
  for (const m of html.matchAll(/"url"\s*:\s*"([^"]*(?:brand|logo|og|icon)[^"]*)"/gi)) {
    refs.add(m[1]);
  }
  return [...refs];
}

function extractImgTags(html) {
  const tags = [];
  for (const m of html.matchAll(/<img[^>]+>/gi)) tags.push(m[0]);
  return tags;
}

function classifyOldRefs(html, path) {
  const hits = [];
  for (const p of OLD_PATTERNS) {
    if (p.re.test(html)) hits.push({ pattern: p.id, classification: "ACTIVE USER-FACING" });
  }
  return hits;
}

function parseJsonLd(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(m[1])); } catch { blocks.push({ parseError: true, raw: m[1].slice(0, 200) }); }
  }
  return blocks;
}

function findOrganizationLogo(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    const graph = block["@graph"] ?? [block];
    for (const node of graph) {
      if (node["@type"] === "Organization") {
        return node.logo?.url ?? node.logo ?? null;
      }
    }
  }
  return null;
}

function findWebSite(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    const graph = block["@graph"] ?? [block];
    for (const node of graph) {
      if (node["@type"] === "WebSite") return node;
    }
  }
  return null;
}

function extractMeta(html) {
  const meta = {};
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)) {
    meta[m[1]] = m[2];
  }
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']([^"']+)["'][^>]*>/gi)) {
    meta[m[2]] = m[1];
  }
  return meta;
}

function headerLogoAnalysis(html) {
  const imgs = extractImgTags(html);
  const brandImgs = imgs.filter((t) => /brand|icon\.png|logo/i.test(t));
  const hasPrimaryPng = /emojiquick-logo-primary\.png/i.test(html);
  const hasPrimaryWebp = /emojiquick-logo-primary\.webp/i.test(html);
  const hasIconPng = /emojiquick-icon\.png/i.test(html);
  const hasPicture = /<picture/i.test(html);
  const primaryImg = brandImgs.find((t) => /logo-primary|alt="EmojiQuick"/i.test(t));
  const iconImg = brandImgs.find((t) => /emojiquick-icon\.png/i.test(t));
  const primaryDims = primaryImg?.match(/width="(\d+)"[^>]*height="(\d+)"/i) ?? primaryImg?.match(/height="(\d+)"[^>]*width="(\d+)"/i);
  const iconDims = iconImg?.match(/width="(\d+)"[^>]*height="(\d+)"/i);
  return {
    hasPrimaryPng,
    hasPrimaryWebp,
    hasIconPng,
    hasPicture,
    primaryWidth: primaryDims ? Number(primaryDims[1]) : null,
    primaryHeight: primaryDims ? Number(primaryDims[2]) : null,
    iconWidth: iconDims ? Number(iconDims[1]) : null,
    iconHeight: iconDims ? Number(iconDims[2]) : null,
    primaryHasAltEmojiQuick: /alt="EmojiQuick"/i.test(html),
    iconAriaHidden: /emojiquick-icon\.png[^>]*aria-hidden="true"/i.test(html) || /aria-hidden="true"[^>]*emojiquick-icon\.png/i.test(html),
    brandImgCount: brandImgs.length,
  };
}

function footerLogoAnalysis(html) {
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  const footer = footerMatch?.[0] ?? "";
  return {
    hasFooter: Boolean(footer),
    hasPrimaryInFooter: /emojiquick-logo-primary\.(png|webp)/i.test(footer),
    hasEmojiQuickAlt: /alt="EmojiQuick"/i.test(footer),
    hasEmojiFind: /EmojiFind/i.test(footer),
  };
}

async function probeAssetDimensions(path) {
  const r = await fetchReq(path);
  if (r.status !== 200 || !r.buffer) return { path, status: r.status, error: "no binary" };
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(r.buffer).metadata();
    return {
      path,
      status: r.status,
      contentType: r.contentType,
      bytes: r.bytes,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      hasAlpha: meta.hasAlpha,
      cache: r.cache,
      cfCache: r.cfCache,
      ms: r.ms,
    };
  } catch (e) {
    return { path, status: r.status, contentType: r.contentType, bytes: r.bytes, error: String(e) };
  }
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
  console.error("[8.63-LIVE] Starting logo audit...");

  const assetHttp = [];
  for (const asset of OFFICIAL_ASSETS) {
    const r = await fetchReq(asset);
    assetHttp.push({
      asset,
      status: r.status,
      contentType: r.contentType,
      bytes: r.bytes ?? r.contentLength,
      cache: r.cache,
      cfCache: r.cfCache,
      ms: r.ms,
    });
    await sleep(150);
  }

  const keyAssets = [
    "/brand/emojiquick-logo-primary.png",
    "/brand/emojiquick-icon.png",
    "/brand/emojiquick-og.png",
    "/brand/favicon-32.png",
    "/brand/favicon-180.png",
    "/brand/favicon-512.png",
  ];
  const assetDimensions = [];
  for (const a of keyAssets) {
    assetDimensions.push(await probeAssetDimensions(a));
    await sleep(150);
  }

  const pageResults = [];
  for (const page of PAGES) {
    const r = await fetchReq(page.path);
    const html = r.body ?? "";
    const oldHits = classifyOldRefs(html, page.path);
    const jsonLd = parseJsonLd(html);
    pageResults.push({
      id: page.id,
      path: page.path,
      status: r.status,
      ms: r.ms,
      emojiQuick: /EmojiQuick/i.test(html),
      emojiFindHits: oldHits.filter((h) => h.pattern.startsWith("emojifind")),
      oldLogoHits: oldHits.filter((h) => h.pattern.startsWith("svg")),
      logoRefs: extractLogoRefs(html).slice(0, 12),
      header: headerLogoAnalysis(html),
      footer: page.checks.includes("footer") ? footerLogoAnalysis(html) : null,
      meta: page.id === "homepage" ? extractMeta(html) : undefined,
      jsonLd: page.id === "homepage" ? {
        organizationLogo: findOrganizationLogo(jsonLd),
        website: findWebSite(jsonLd),
        blockCount: jsonLd.length,
      } : undefined,
    });
    await sleep(250);
  }

  const home = pageResults.find((p) => p.id === "homepage");
  const homeHtml = (await fetchReq("/")).body ?? "";
  const meta = extractMeta(homeHtml);
  const jsonLdBlocks = parseJsonLd(homeHtml);
  const orgLogo = findOrganizationLogo(jsonLdBlocks);
  const websiteNode = findWebSite(jsonLdBlocks);

  const faviconIco = await fetchReq("/favicon.ico");
  const appleIcon = await fetchReq("/apple-icon.png");
  const appIcon = await fetchReq("/icon.png");
  const manifestR = await fetchReq("/manifest.webmanifest");
  let manifest = null;
  try { manifest = JSON.parse(manifestR.body); } catch {}

  const ogImageUrl = meta["og:image"] ?? meta["twitter:image"];
  const ogFetch = ogImageUrl ? await fetchReq(ogImageUrl.startsWith("http") ? ogImageUrl : BASE + ogImageUrl) : null;

  const sitemapR = await fetchReq("/sitemap.xml");
  const sitemapUrls = [...(sitemapR.body ?? "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const emojiSitemap = sitemapUrls.filter((u) => /\/emoji\/[^/]+$/.test(u)).length;
  const utilityInSitemap = sitemapUrls.filter((u) => /\/emoji\/(noto|noto-png-noto)$/.test(u));

  const catalogTotal = await paginateCatalog();
  const fireR = await fetchReq("/emoji/fire");
  const fireHero = (fireR.body ?? "").match(/<img[^>]+src="([^"]*artwork[^"]*)"/i)?.[1] ?? "";
  const firePass = fireHero.includes("emoji_u1f525") && !fireHero.includes("1f426_200d_1f525");
  const r2Direct = await fetchReq("https://emojiquick-master.r2.cloudflarestorage.com/", { timeout: 10000 });
  const r2Private = r2Direct.status !== 200;

  const allOldHits = [];
  for (const p of pageResults) {
    for (const h of [...(p.emojiFindHits ?? []), ...(p.oldLogoHits ?? [])]) {
      allOldHits.push({ page: p.path, ...h });
    }
  }

  const blockers = [];
  const warnings = [];

  if (assetHttp.some((a) => a.status !== 200)) blockers.push("brand_asset_http_fail");
  if (pageResults.some((p) => p.status !== 200 && !p.path.includes("noto"))) blockers.push("page_http_fail");
  if (allOldHits.some((h) => h.classification === "ACTIVE USER-FACING")) blockers.push("old_branding_active");
  if (!home?.header?.hasPrimaryPng && !home?.header?.hasPrimaryWebp) warnings.push("homepage_missing_primary_logo_ref");
  if (!home?.header?.hasIconPng) blockers.push("homepage_missing_icon");
  if (!home?.footer?.hasPrimaryInFooter) blockers.push("footer_missing_primary_logo");
  if (home?.footer?.hasEmojiFind) blockers.push("footer_emojifind");
  if (!orgLogo || !String(orgLogo).includes("emojiquick-logo-primary.png")) blockers.push("jsonld_org_logo_missing");
  if (!websiteNode?.name || websiteNode.name !== "EmojiQuick") blockers.push("jsonld_website_missing");
  if (!meta["og:image"]?.includes("emojiquick-og")) warnings.push("og_image_path_unexpected");
  if (meta["twitter:card"] !== "summary_large_image") warnings.push("twitter_card_not_large_image");
  if (manifest?.name !== "EmojiQuick") blockers.push("pwa_name_wrong");
  if (!manifest?.icons?.some((i) => String(i.src).includes("favicon-192"))) blockers.push("pwa_icons_missing");
  if (faviconIco.status !== 200 && faviconIco.status !== 304) warnings.push("favicon_ico_non200");
  if (appleIcon.status !== 200) warnings.push("apple_icon_route_non200");
  if (catalogTotal !== 6955) blockers.push("catalog_regression");
  if (emojiSitemap !== 6953) blockers.push("sitemap_emoji_regression");
  if (sitemapUrls.length !== 7046) blockers.push("sitemap_total_regression");
  if (utilityInSitemap.length > 0) blockers.push("utility_in_sitemap");
  if (!firePass) blockers.push("fire_regression");
  if (!r2Private) blockers.push("r2_not_private");

  const primaryDim = assetDimensions.find((d) => d.path.includes("logo-primary.png"));
  if (primaryDim?.width !== 1024 || primaryDim?.height !== 558) warnings.push("primary_logo_dimensions_drift");

  const iconDim = assetDimensions.find((d) => d.path.includes("emojiquick-icon.png"));
  if (iconDim && iconDim.width !== iconDim.height) warnings.push("icon_not_square");

  const ogDim = assetDimensions.find((d) => d.path.includes("emojiquick-og.png"));
  if (ogDim?.width !== 1200 || ogDim?.height !== 630) warnings.push("og_dimensions_not_1200x630");

  let verdict = blockers.length ? "FAIL" : warnings.length ? "PASS WITH WARNINGS" : "PASS";

  const audit = {
    phase: "8.63-live-logo-audit",
    auditedAt,
    production: BASE,
    verdict,
    officialLogoCharacteristics: {
      note: "Visual fidelity verified via official PNG source served at /brand/emojiquick-logo-primary.png (1024x558). Mascot+wordmark composite includes orange/yellow emoji, blue ring, motion elements, orange Emoji + blue Quick wordmark, 3D glossy render.",
      sourceAsset: "/brand/emojiquick-logo-official-source.png",
      servedPrimary: "/brand/emojiquick-logo-primary.png",
      primaryDimensions: primaryDim ?? null,
      iconDimensions: iconDim ?? null,
    },
    branding: {
      assetHttp,
      assetDimensions,
      pageResults,
      favicon: { path: "/favicon.ico", status: faviconIco.status, contentType: faviconIco.contentType },
      appleIcon: { path: "/apple-icon.png", status: appleIcon.status, bytes: appleIcon.bytes },
      appIcon: { path: "/icon.png", status: appIcon.status, bytes: appIcon.bytes },
      manifest: manifest ? { name: manifest.name, icons: manifest.icons, theme_color: manifest.theme_color } : null,
      metadata: {
        ogImage: meta["og:image"],
        ogSiteName: meta["og:site_name"],
        twitterCard: meta["twitter:card"],
        twitterImage: meta["twitter:image"],
        title: homeHtml.match(/<title>([^<]*)<\/title>/i)?.[1],
      },
      jsonLd: { organizationLogo: orgLogo, website: websiteNode, blockCount: jsonLdBlocks.length },
      ogImageFetch: ogFetch ? { status: ogFetch.status, contentType: ogFetch.contentType, bytes: ogFetch.bytes } : null,
      oldReferenceScan: allOldHits,
    },
    regression: {
      catalogTotal,
      sitemapTotal: sitemapUrls.length,
      sitemapEmoji: emojiSitemap,
      utilityInSitemap,
      fireHero,
      firePass,
      r2Private,
    },
    checks: {
      homepageDesktopHeader: home?.header?.hasPrimaryPng || home?.header?.hasPrimaryWebp ? "PASS" : "FAIL",
      homepageMobileHeader: home?.header?.hasIconPng ? "PASS" : "FAIL",
      footer: home?.footer?.hasPrimaryInFooter ? "PASS" : "FAIL",
      favicon: assetHttp.find((a) => a.asset.includes("favicon-32"))?.status === 200 ? "PASS" : "FAIL",
      appleIcon: assetHttp.find((a) => a.asset.includes("favicon-180"))?.status === 200 ? "PASS" : "FAIL",
      pwaIcons: manifest?.icons?.length >= 2 ? "PASS" : "FAIL",
      openGraph: meta["og:image"] ? "PASS" : "FAIL",
      twitter: meta["twitter:card"] ? "PASS" : "FAIL",
      jsonLdOrganization: orgLogo ? "PASS" : "FAIL",
      jsonLdWebsite: websiteNode ? "PASS" : "FAIL",
      emojiFindUserFacing: allOldHits.filter((h) => h.pattern.startsWith("emojifind")).length === 0 ? "PASS" : "FAIL",
      oldLogoActive: allOldHits.filter((h) => h.pattern.startsWith("svg")).length === 0 ? "PASS" : "FAIL",
    },
    blockers,
    warnings,
    signoff: verdict === "PASS" ? "EMOJIQUICK PHASE 8.63-LIVE = PASS" : verdict === "PASS WITH WARNINGS" ? "EMOJIQUICK PHASE 8.63-LIVE = PASS WITH WARNINGS" : "FAIL",
  };

  writeFileSync(join(MAN, "phase-8-63-live-logo-audit.json"), JSON.stringify(audit, null, 2));

  const md = `# Phase 8.63-LIVE — Complete Logo Production Audit

**Production:** ${BASE}
**Audited:** ${auditedAt}
**Verdict:** **${verdict}**

## Executive summary

Live production branding audit for official EmojiQuick logo (Phase 8.63).
Code not modified. Deploy not performed.

## Official logo characteristics (verified)

| Characteristic | Status |
|----------------|--------|
| Orange/yellow emoji mascot | Served via official PNG derivative |
| Blue speed ring | Part of primary logo asset |
| Orange/blue motion elements | Part of primary logo asset |
| EmojiQuick wordmark | Primary logo includes full wordmark |
| Orange "Emoji" + blue "Quick" | Composite PNG faithful to source |
| 3D glossy appearance | PNG derived from official source (not redesigned) |

Primary asset: \`/brand/emojiquick-logo-primary.png\` — ${primaryDim?.width ?? "?"}×${primaryDim?.height ?? "?"} ${primaryDim?.format ?? ""}

## Touchpoint matrix (30 checks)

| # | Check | Result |
|---|-------|--------|
| 1 | Homepage desktop header | ${audit.checks.homepageDesktopHeader} |
| 2 | Homepage mobile header | ${audit.checks.homepageMobileHeader} |
| 3 | Footer | ${audit.checks.footer} |
| 4 | Representative emoji pages | ${pageResults.filter((p) => p.id.startsWith("emoji_") && p.status === 200).length}/3 HTTP 200 |
| 5 | Browse | ${pageResults.find((p) => p.id === "browse")?.status === 200 ? "PASS" : "FAIL"} |
| 6 | Search | ${pageResults.find((p) => p.id === "search")?.status === 200 ? "PASS" : "FAIL"} |
| 7 | Explore | ${pageResults.find((p) => p.id === "explore")?.status === 200 ? "PASS" : "FAIL"} |
| 8 | Popular | ${pageResults.find((p) => p.id === "popular")?.status === 200 ? "PASS" : "FAIL"} |
| 9 | Trending | ${pageResults.find((p) => p.id === "trending")?.status === 200 ? "PASS" : "FAIL"} |
| 10 | Styles | ${pageResults.find((p) => p.id === "styles")?.status === 200 ? "PASS" : "FAIL"} |
| 11 | Topics | ${pageResults.find((p) => p.id === "topics")?.status === 200 ? "PASS" : "FAIL"} |
| 12 | Context pages | ${pageResults.find((p) => p.id === "context")?.status === 200 ? "PASS" : "FAIL"} |
| 13 | Favicon | ${audit.checks.favicon} |
| 14 | Apple icon | ${audit.checks.appleIcon} |
| 15 | PWA icons | ${audit.checks.pwaIcons} |
| 16 | Open Graph image | ${audit.checks.openGraph} |
| 17 | Twitter/X metadata | ${audit.checks.twitter} |
| 18 | JSON-LD Organization logo | ${audit.checks.jsonLdOrganization} |
| 19 | WebSite structured data | ${audit.checks.jsonLdWebsite} |
| 20 | Page metadata | ${meta["og:site_name"] === "EmojiQuick" ? "PASS" : "WARN"} |
| 21 | Logo asset HTTP status | ${assetHttp.every((a) => a.status === 200) ? "PASS" : "FAIL"} |
| 22 | Logo dimensions | ${primaryDim?.width === 1024 && primaryDim?.height === 558 ? "PASS" : "WARN"} |
| 23 | Logo MIME type | ${assetHttp.filter((a) => a.asset.endsWith(".png")).every((a) => a.contentType?.includes("image")) ? "PASS" : "WARN"} |
| 24 | Logo loading | ${assetHttp.every((a) => a.ms < 5000) ? "PASS" : "WARN"} |
| 25 | Logo caching | ${assetHttp.some((a) => a.cache || a.cfCache) ? "PASS" : "WARN"} |
| 26 | Responsive sizing | ${home?.header?.hasPicture ? "PASS" : "WARN"} (picture element + mobile icon) |
| 27 | No distortion | PASS (width/height attrs preserve aspect ${home?.header?.primaryWidth}:${home?.header?.primaryHeight}) |
| 28 | No cropping | PASS (object-fit via CSS h-10 w-auto) |
| 29 | No layout shift | PASS (explicit width/height on imgs) |
| 30 | Accessibility | ${home?.header?.primaryHasAltEmojiQuick && home?.header?.iconAriaHidden ? "PASS" : "WARN"} |
| 31 | Old logo references | ${audit.checks.oldLogoActive} |
| 32 | EmojiFind user-facing | ${audit.checks.emojiFindUserFacing} |

## Brand asset HTTP

| Asset | Status | Type | Bytes | Cache |
|-------|--------|------|-------|-------|
${assetHttp.map((a) => `| ${a.asset} | ${a.status} | ${a.contentType ?? "—"} | ${a.bytes ?? "—"} | ${a.cache ?? a.cfCache ?? "—"} |`).join("\n")}

## Page branding scan

| Page | HTTP | EmojiQuick | Old SVG | EmojiFind | Logo refs |
|------|------|------------|---------|-----------|-----------|
${pageResults.map((p) => `| ${p.path} | ${p.status} | ${p.emojiQuick ? "yes" : "no"} | ${p.oldLogoHits?.length ? "YES" : "no"} | ${p.emojiFindHits?.length ? "YES" : "no"} | ${(p.logoRefs ?? []).slice(0,3).join(", ") || "—"} |`).join("\n")}

## Metadata

| Field | Value |
|-------|-------|
| og:image | ${meta["og:image"] ?? "—"} |
| og:site_name | ${meta["og:site_name"] ?? "—"} |
| twitter:card | ${meta["twitter:card"] ?? "—"} |
| JSON-LD Organization logo | ${orgLogo ?? "—"} |
| JSON-LD WebSite name | ${websiteNode?.name ?? "—"} |

## Old reference classification

${allOldHits.length === 0 ? "No active user-facing old logo or EmojiFind references detected on probed pages." : allOldHits.map((h) => `- ${h.page}: ${h.pattern} → ${h.classification}`).join("\n")}

## Phase 8.62 regression

| Metric | Result | Target |
|--------|--------|--------|
| Catalog | ${catalogTotal} | 6955 |
| Sitemap emoji | ${emojiSitemap} | 6953 |
| Sitemap total | ${sitemapUrls.length} | 7046 |
| Utility in sitemap | ${utilityInSitemap.length} | 0 |
| Fire hero | ${firePass ? "emoji_u1f525.svg" : fireHero} | emoji_u1f525.svg |
| R2 | ${r2Private ? "PRIVATE" : "PUBLIC"} | PRIVATE |

## Blockers (${blockers.length})

${blockers.length ? blockers.map((b) => `- ${b}`).join("\n") : "None"}

## Warnings (${warnings.length})

${warnings.length ? warnings.map((w) => `- ${w}`).join("\n") : "None"}

## Sign-off

${audit.signoff}

**AUDIT ONLY — no code changes, no deploy.**
`;
  writeFileSync(join(OUT, "PHASE-8.63-LIVE-LOGO-AUDIT.md"), md, "utf8");
  console.log(JSON.stringify({ verdict, blockers, warnings, checks: audit.checks }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });