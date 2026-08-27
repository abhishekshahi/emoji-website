/**
 * Steps 6–12 — independent production forensic first audit (read-only).
 * Targets https://emojiquick.com. Does not modify application code.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CURATED_INTENT_SLUGS } from "@/lib/kaomoji/seo/intent-registry";
import { EMOJIQUICK_TAXONOMY, TAXONOMY_GROUPS } from "@/lib/kaomoji/processing/phase9/taxonomy";
import { EVENT_PAGE_SLUGS } from "@/lib/kaomoji/events/registry";
import { MEANING_PAGE_SLUGS } from "@/lib/kaomoji/seo/meaning-pages";
import { USE_CASE_PAGE_SLUGS } from "@/lib/kaomoji/seo/use-case-pages";
import { LOCALIZED_SEARCH_TERMS } from "@/lib/kaomoji/localization/search-terms";
import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { PRIMARY_LANGUAGE, SUPPORTED_LANGUAGES } from "@/lib/content/localization/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const CUSTOM = "https://emojiquick.com";
const WORKER = "https://emoji-website.emoji-website.workers.dev";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface Finding {
  id: string;
  feature: string;
  severity: Severity;
  url?: string;
  test: string;
  expected: string;
  actual: string;
  evidence: string;
  recommendation: string;
}

const findings: Finding[] = [];
let fid = 0;

function add(
  feature: string,
  severity: Severity,
  test: string,
  expected: string,
  actual: string,
  evidence: string,
  recommendation: string,
  url?: string,
) {
  findings.push({
    id: `S6-12-F${++fid}`,
    feature,
    severity,
    url,
    test,
    expected,
    actual,
    evidence,
    recommendation,
  });
}

async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; text: string; ms: number; headers: Headers }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text();
    return { status: res.status, text, ms: Date.now() - t0, headers: res.headers };
  } catch (e) {
    return {
      status: 0,
      text: String(e),
      ms: Date.now() - t0,
      headers: new Headers(),
    };
  }
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetchText(url, init);
  try {
    return { ...r, data: JSON.parse(r.text) as unknown };
  } catch {
    return { ...r, data: null };
  }
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return (m?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
}

function extractCanonical(html: string): string {
  const m = html.match(/rel="canonical"\s+href="([^"]+)"/i) || html.match(/href="([^"]+)"\s+rel="canonical"/i);
  return m?.[1] ?? "";
}

function extractMetaDesc(html: string): string {
  const m = html.match(/name="description"\s+content="([^"]*)"/i) || html.match(/content="([^"]*)"\s+name="description"/i);
  return m?.[1] ?? "";
}

function extractRobots(html: string): string {
  const m = html.match(/name="robots"\s+content="([^"]*)"/i) || html.match(/content="([^"]*)"\s+name="robots"/i);
  return m?.[1] ?? "";
}

function hasJsonLd(html: string): boolean {
  return /application\/ld\+json/i.test(html);
}

function countKaomojiCards(html: string): number {
  // Detail/card links typically /kaomoji/kao-...
  const set = new Set(html.match(/\/kaomoji\/kao-[a-f0-9]{16}/gi) ?? []);
  return set.size;
}

const DETAIL_SAMPLES = [
  "kao-00013e7cc777f411",
  "kao-000231c85784b630",
  "kao-000b1a777f4f1bb2",
  "kao-001698c24eb72787",
  "kao-0021939944d44c05",
  "kao-00455e9793fc1fb7",
  "kao-00687345aa1c84d4",
  "kao-0069d4f8387094b4",
  "kao-007156df3de39a14",
  "kao-00a8686d2ce1d6e0",
  "kao-00ead39e527ec2a8",
  "kao-018fe9a114c85b2d",
  "kao-01d1f0540e8afa01",
  "kao-6718c0cf7a018b68",
  "kao-fc681f6ae55feb5e",
  "kao-fc686c6620bbf85a",
  "kao-fc6975610b550682",
  "kao-fc69a01f224d146b",
  "kao-fc6ae407851a9dcf",
  "kao-fcad26e7d3a423b2",
  "kao-f9485e8981545c68",
  "kao-f37a85067ec9ce21",
  "kao-e970266b930d222d",
  "kao-e78f168884eb0d93",
  "kao-0081f55e2fc9e1a9",
  "kao-008717e08a02cbf6",
  "kao-00ac6df0f4400e03",
  "kao-01eca17f36574f9a",
  "kao-0011a3086a5a8a47",
  "kao-0047c46c41517429",
  "kao-00c8f0a1b2c3d4e5", // likely invalid — probe 404 handling
  "kao-aaaaaaaaaaaaaaaa",
] as const;

// Known blocked slug from prior scripts — independently verify 404
const BLOCKED_CANDIDATES = [
  "kao-000c332b7e7b5b52",
  "kao-0000000000000001",
  "kao-ffffffffffffffff",
];

const SECURITY_PAYLOADS = [
  "/kaomoji/categories/%3Cscript%3Ealert(1)%3C/script%3E",
  "/kaomoji/search?q=%3Cscript%3Ealert(1)%3C/script%3E",
  "/kaomoji/search?q=' OR 1=1 --",
  "/kaomoji/happy?page=-1",
  "/kaomoji/happy?page=0",
  "/kaomoji/happy?page=999999",
  "/kaomoji/happy?page=abc",
  "/kaomoji/../../etc/passwd",
  "/kaomoji/%2e%2e/%2e%2e/etc/passwd",
  "/api/kaomoji/search?q=__proto__[x]=1",
  "/api/kaomoji/related?slug=kao-00013e7cc777f411&similar_limit=99999",
  "/api/kaomoji/popular?kind=popular&limit=-5",
  "/kaomoji/events/new-year?utm=../../admin",
  "/xx/kaomoji",
  "/kaomoji/meaning/%3Cimg%20src=x%20onerror=alert(1)%3E",
  "/kaomoji/for/%22%3E%3Cscript%3Ealert(1)%3C/script%3E",
  "/kaomoji/my?collection=%3Cscript%3E",
  "/api/kaomoji/personal/resolve",
  "/api/kaomoji/search/suggest?q=%00%00",
  "/kaomoji/collections/love-kaomoji/page/-1",
];

const MULTILINGUAL_QUERIES: Record<string, string[]> = {
  en: ["happy", "cute", "love", "sad", "hug", "angry", "cat", "kiss", "sorry", "laugh"],
  es: ["feliz", "lindo", "amor", "triste", "abrazo", "enojado", "gato", "beso", "perdon", "risa"],
  fr: ["heureux", "mignon", "amour", "triste", "calin", "en colere", "chat", "bisou", "desole", "rire"],
  de: ["glücklich", "süß", "liebe", "traurig", "umarmung", "wütend", "katze", "kuss", "entschuldigung", "lachen"],
  hi: ["खुश", "प्यारा", "प्यार", "उदास", "गले", "गुस्सा", "बिल्ली", "चूमना", "माफ़", "हंसी"],
  ja: ["嬉しい", "かわいい", "愛", "悲しい", "ハグ", "怒り", "猫", "キス", "ごめん", "笑い"],
  ko: ["행복", "귀여운", "사랑", "슬픔", "포옹", "화난", "고양이", "키스", "미안", "웃음"],
  zh: ["开心", "可爱", "爱", "伤心", "拥抱", "生气", "猫", "吻", "对不起", "笑"],
  pt: ["feliz", "fofo", "amor", "triste", "abraco", "bravo", "gato", "beijo", "desculpa", "risada"],
  it: ["felice", "carino", "amore", "triste", "abbraccio", "arrabbiato", "gatto", "bacio", "scusa", "risata"],
};

async function mapPool<T, R>(items: readonly T[], concurrency: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function main() {
  const started = new Date().toISOString();
  console.log(`[audit] Steps 6–12 first forensic audit against ${CUSTOM}`);

  // ---- Environment / BUILD ----
  const build = await fetchText(`${CUSTOM}/BUILD_ID`);
  const buildId = build.text.trim();
  console.log(`[audit] BUILD_ID=${buildId} status=${build.status}`);

  const home = await fetchText(`${CUSTOM}/`);
  if (home.status !== 200) {
    add("global", "CRITICAL", "homepage", "200", String(home.status), home.text.slice(0, 200), "Investigate production outage", `${CUSTOM}/`);
  }

  // Security headers on homepage
  const csp = home.headers.get("content-security-policy") ?? "";
  const xfo = home.headers.get("x-frame-options") ?? "";
  const xcto = home.headers.get("x-content-type-options") ?? "";
  const rp = home.headers.get("referrer-policy") ?? "";
  if (!csp) add("security", "MEDIUM", "CSP header", "present", "missing", "homepage response", "Ensure CSP is set", `${CUSTOM}/`);
  if (xfo.toUpperCase() !== "SAMEORIGIN" && xfo.toUpperCase() !== "DENY") {
    add("security", "MEDIUM", "X-Frame-Options", "SAMEORIGIN|DENY", xfo || "missing", "homepage", "Set X-Frame-Options", `${CUSTOM}/`);
  }
  if (xcto.toLowerCase() !== "nosniff") {
    add("security", "LOW", "X-Content-Type-Options", "nosniff", xcto || "missing", "homepage", "Set nosniff", `${CUSTOM}/`);
  }
  if (!rp) add("security", "LOW", "Referrer-Policy", "present", "missing", "homepage", "Set Referrer-Policy", `${CUSTOM}/`);

  // ---- Sitemap inventory ----
  const sm = await fetchText(`${CUSTOM}/sitemap.xml`);
  const sitemapUrls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const uniqueSitemap = new Set(sitemapUrls);
  const kaomojiSitemap = sitemapUrls.filter((u) => u.includes("/kaomoji"));
  const myInSitemap = sitemapUrls.filter((u) => /\/kaomoji\/my(\/|$|\?)/.test(u));
  console.log(`[audit] sitemap urls=${sitemapUrls.length} unique=${uniqueSitemap.size} kaomoji=${kaomojiSitemap.length}`);

  if (sm.status !== 200) {
    add("seo", "HIGH", "sitemap fetch", "200", String(sm.status), "sitemap.xml", "Fix sitemap endpoint", `${CUSTOM}/sitemap.xml`);
  }
  if (sitemapUrls.length !== uniqueSitemap.size) {
    add(
      "seo",
      "MEDIUM",
      "sitemap duplicates",
      "0 duplicate locs",
      `${sitemapUrls.length - uniqueSitemap.size} duplicates`,
      `total=${sitemapUrls.length} unique=${uniqueSitemap.size}`,
      "Deduplicate sitemap entries",
      `${CUSTOM}/sitemap.xml`,
    );
  }
  if (myInSitemap.length > 0) {
    add(
      "privacy",
      "CRITICAL",
      "personal collections in sitemap",
      "0 /kaomoji/my URLs",
      String(myInSitemap.length),
      myInSitemap.slice(0, 5).join(", "),
      "Exclude personal library from sitemap",
      myInSitemap[0],
    );
  }

  // ---- Step 6: Categories ----
  console.log("[audit] Step 6 — categories");
  const catIndex = await fetchText(`${CUSTOM}/kaomoji/categories`);
  const step6: Record<string, unknown> = {
    taxonomy_groups_in_source: TAXONOMY_GROUPS.length,
    taxonomy_categories_in_source: EMOJIQUICK_TAXONOMY.length,
    curated_intents: CURATED_INTENT_SLUGS.length,
    categories_index_status: catIndex.status,
    categories_index_ms: catIndex.ms,
    categories_title: extractTitle(catIndex.text),
    categories_h1: extractH1(catIndex.text),
    categories_canonical: extractCanonical(catIndex.text),
    group_pages: [] as unknown[],
    intent_pages: [] as unknown[],
  };

  if (catIndex.status !== 200) {
    add("step6", "HIGH", "categories index", "200", String(catIndex.status), `ms=${catIndex.ms}`, "Fix /kaomoji/categories", `${CUSTOM}/kaomoji/categories`);
  } else {
    if (!extractH1(catIndex.text)) add("step6", "MEDIUM", "categories H1", "present", "missing", extractTitle(catIndex.text), "Add H1", `${CUSTOM}/kaomoji/categories`);
    if (!extractCanonical(catIndex.text).includes("/kaomoji/categories")) {
      add("step6", "MEDIUM", "categories canonical", "…/kaomoji/categories", extractCanonical(catIndex.text) || "missing", "HTML head", "Fix canonical", `${CUSTOM}/kaomoji/categories`);
    }
  }

  // Enumerate curated intent pages (production category/subcategory surfaces)
  const intentResults = await mapPool([...CURATED_INTENT_SLUGS], 6, async (slug) => {
    const path = `/kaomoji/${slug}`;
    const r = await fetchText(`${CUSTOM}${path}`);
    return {
      slug,
      status: r.status,
      ms: r.ms,
      title: extractTitle(r.text),
      h1: extractH1(r.text),
      description: extractMetaDesc(r.text),
      canonical: extractCanonical(r.text),
      robots: extractRobots(r.text),
      jsonLd: hasJsonLd(r.text),
      cardCount: countKaomojiCards(r.text),
      htmlLen: r.text.length,
    };
  });
  (step6.intent_pages as unknown[]) = intentResults;

  for (const p of intentResults) {
    const url = `${CUSTOM}/kaomoji/${p.slug}`;
    if (p.status !== 200) {
      add("step6", "HIGH", `intent page ${p.slug}`, "200", String(p.status), `ms=${p.ms}`, "Investigate missing category page", url);
      continue;
    }
    if (!p.h1) add("step6", "MEDIUM", `H1 ${p.slug}`, "present", "missing", p.title, "Add H1", url);
    if (!p.canonical.includes(`/kaomoji/${p.slug}`)) {
      add("step6", "MEDIUM", `canonical ${p.slug}`, `…/kaomoji/${p.slug}`, p.canonical || "missing", "head", "Fix canonical", url);
    }
    if (p.cardCount < 1) {
      add("step6", "HIGH", `content ${p.slug}`, ">=1 public kaomoji cards", String(p.cardCount), `htmlLen=${p.htmlLen}`, "Page may be thin/empty", url);
    }
    if (!p.jsonLd) add("step6", "LOW", `JSON-LD ${p.slug}`, "present", "missing", "HTML", "Add structured data", url);
  }

  // Pagination edge cases on a representative category
  for (const page of ["1", "2", "0", "-1", "999999", "abc"]) {
    const path = `/kaomoji/happy?page=${page}`;
    const r = await fetchText(`${CUSTOM}${path}`);
    if (r.status >= 500) {
      add("step6", "HIGH", `pagination happy page=${page}`, "non-5xx", String(r.status), r.text.slice(0, 120), "Handle invalid pagination safely", `${CUSTOM}${path}`);
    } else if (["0", "-1", "abc", "999999"].includes(page) && r.status === 200 && /error|exception|stack/i.test(r.text)) {
      add("step6", "MEDIUM", `pagination leak happy page=${page}`, "no stack/error leak", "possible leak", r.text.slice(0, 200), "Sanitize error pages", `${CUSTOM}${path}`);
    }
  }

  // ---- Step 7: Related ----
  console.log("[audit] Step 7 — related");
  const relatedPerf: number[] = [];
  const relatedSamples: unknown[] = [];
  let selfRec = 0;
  let dupRec = 0;
  let blockedRec = 0;
  let pairsChecked = 0;
  let weakPairs = 0;

  const detailResults = await mapPool(DETAIL_SAMPLES.slice(0, 50), 5, async (slug) => {
    const page = await fetchText(`${CUSTOM}/kaomoji/${slug}`);
    const api = await fetchJson(`${CUSTOM}/api/kaomoji/related?slug=${slug}&similar_limit=8&related_limit=12`);
    relatedPerf.push(api.ms);
    const data = api.data as {
      canonical_id?: string;
      similar?: Array<{ canonical_id: string; slug: string; content: string }>;
      related?: Array<{ canonical_id: string; slug: string; content: string }>;
      found?: boolean;
      rejected?: boolean;
    } | null;

    const similar = data?.similar ?? [];
    const related = data?.related ?? [];
    const all = [...similar, ...related];
    const ids = all.map((x) => x.canonical_id);
    const slugs = all.map((x) => x.slug);
    if (data?.canonical_id && ids.includes(data.canonical_id)) selfRec++;
    if (new Set(ids).size !== ids.length || new Set(slugs).size !== slugs.length) dupRec++;
    for (const hit of all) {
      pairsChecked++;
      if (!hit.slug || !hit.content) weakPairs++;
      if (BLOCKED_CANDIDATES.includes(hit.slug)) blockedRec++;
    }

    // Check related section exists on HTML when page is 200
    const hasRelatedUi = /related|similar/i.test(page.text);
    return {
      slug,
      page_status: page.status,
      page_ms: page.ms,
      api_status: api.status,
      api_ms: api.ms,
      found: data?.found,
      similar_count: similar.length,
      related_count: related.length,
      hasRelatedUi,
      title: extractTitle(page.text),
    };
  });
  relatedSamples.push(...detailResults);

  for (const d of detailResults) {
    const url = `${CUSTOM}/kaomoji/${d.slug}`;
    // Skip likely-invalid fabricated slugs
    if (d.slug === "kao-00c8f0a1b2c3d4e5" || d.slug === "kao-aaaaaaaaaaaaaaaa") {
      if (d.page_status === 200) {
        add("step7", "MEDIUM", `invalid slug served ${d.slug}`, "404", String(d.page_status), "fabricated slug returned 200", "Ensure unknown slugs 404", url);
      }
      continue;
    }
    if (d.page_status !== 200 && d.page_status !== 404) {
      add("step7", "HIGH", `detail ${d.slug}`, "200|404", String(d.page_status), `ms=${d.page_ms}`, "Investigate detail route", url);
    }
    if (d.api_status >= 500) {
      add("step7", "HIGH", `related API ${d.slug}`, "2xx/4xx", String(d.api_status), `ms=${d.api_ms}`, "Fix related API errors", `${CUSTOM}/api/kaomoji/related?slug=${d.slug}`);
    }
  }

  if (selfRec > 0) add("step7", "HIGH", "self-recommendations", "0", String(selfRec), "API related responses", "Exclude self from recommendations");
  if (dupRec > 0) add("step7", "MEDIUM", "duplicate recommendations", "0", String(dupRec), "API related responses", "Deduplicate recommendation lists");
  if (blockedRec > 0) add("step7", "CRITICAL", "blocked in recommendations", "0", String(blockedRec), "API hits matched blocked candidates", "Enforce is_public filter");

  relatedPerf.sort((a, b) => a - b);
  const pct = (p: number) => relatedPerf[Math.min(relatedPerf.length - 1, Math.floor((p / 100) * relatedPerf.length))] ?? 0;

  // ---- Step 8: Trending / Popular ----
  console.log("[audit] Step 8 — rankings");
  const trending = await fetchText(`${CUSTOM}/kaomoji/trending`);
  const popular = await fetchText(`${CUSTOM}/kaomoji/popular`);
  const trendingApi = await fetchJson(`${CUSTOM}/api/kaomoji/trending?kind=trending&limit=24`);
  const risingApi = await fetchJson(`${CUSTOM}/api/kaomoji/trending?kind=rising&limit=12`);
  const popularApi = await fetchJson(`${CUSTOM}/api/kaomoji/popular?kind=popular&limit=24`);
  const copiedApi = await fetchJson(`${CUSTOM}/api/kaomoji/popular?kind=most_copied&limit=12`);

  const step8 = {
    analytics_liveEventsEnabled: ANALYTICS_MATURITY.liveEventsEnabled,
    analytics_ingestEnabled: ANALYTICS_MATURITY.ingestEnabled,
    analytics_rankingLabel: ANALYTICS_MATURITY.rankingLabel,
    trending_status: trending.status,
    popular_status: popular.status,
    trending_title: extractTitle(trending.text),
    popular_title: extractTitle(popular.text),
    trending_h1: extractH1(trending.text),
    popular_h1: extractH1(popular.text),
    trending_claims_live_popularity: /real[- ]world|live popularity|based on views/i.test(trending.text),
    popular_claims_live_popularity: /real[- ]world|live popularity|based on (views|copies)/i.test(popular.text),
    api: {
      trending: { status: trendingApi.status, ms: trendingApi.ms, keys: trendingApi.data && typeof trendingApi.data === "object" ? Object.keys(trendingApi.data as object) : [] },
      rising: { status: risingApi.status, ms: risingApi.ms },
      popular: { status: popularApi.status, ms: popularApi.ms, keys: popularApi.data && typeof popularApi.data === "object" ? Object.keys(popularApi.data as object) : [] },
      most_copied: { status: copiedApi.status, ms: copiedApi.ms },
    },
  };

  if (trending.status !== 200) add("step8", "HIGH", "trending page", "200", String(trending.status), "", "Fix trending route", `${CUSTOM}/kaomoji/trending`);
  if (popular.status !== 200) add("step8", "HIGH", "popular page", "200", String(popular.status), "", "Fix popular route", `${CUSTOM}/kaomoji/popular`);

  // Authenticity: live events disabled — UI must not falsely claim live popularity
  if (!ANALYTICS_MATURITY.liveEventsEnabled) {
    const falseClaim =
      /\b(most viewed|most popular worldwide|real-time trending|based on user views)\b/i.test(trending.text) ||
      /\b(most viewed|most popular worldwide|real-time trending|based on user views)\b/i.test(popular.text);
    if (falseClaim) {
      add(
        "step8",
        "HIGH",
        "fabricated popularity claims",
        "no false live-popularity claims while liveEventsEnabled=false",
        "possible false claim language detected",
        "HTML copy on trending/popular",
        "Label rankings as curated/editorial until live maturity",
        `${CUSTOM}/kaomoji/trending`,
      );
    } else {
      add(
        "step8",
        "INFO",
        "ranking authenticity",
        "editorial fallback while live disabled",
        `liveEventsEnabled=${ANALYTICS_MATURITY.liveEventsEnabled} label=${ANALYTICS_MATURITY.rankingLabel}`,
        "source ANALYTICS_MATURITY + HTML scan",
        "Keep editorial labeling clear",
      );
    }
  }

  // Check API does not expose raw view/copy counts as public popularity theatre
  for (const [name, resp] of [
    ["trending", trendingApi],
    ["popular", popularApi],
  ] as const) {
    const blob = JSON.stringify(resp.data ?? {});
    if (/"viewCount"|"copyCount"|"view_count"|"copy_count"/.test(blob)) {
      add("step8", "MEDIUM", `${name} API count fields`, "no public view/copy counts", "count fields present", blob.slice(0, 300), "Omit raw popularity counts from public API");
    }
  }

  // Manipulation probe: spam analytics ingest
  const spamResults: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetchText(`${CUSTOM}/api/analytics/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "kaomoji_copy",
        canonicalId: "kao-00013e7cc777f411",
        slug: "kao-00013e7cc777f411",
        timestamp: new Date().toISOString(),
      }),
    });
    spamResults.push(r.status);
  }
  // Note manipulation possibility; rankings gated so impact may be none
  add(
    "step8",
    "INFO",
    "analytics ingest spam probe",
    "ingest accepts or rate-limits without corrupting live rankings",
    `statuses=${spamResults.join(",")}`,
    `liveEventsEnabled=${ANALYTICS_MATURITY.liveEventsEnabled}`,
    "Keep readiness gate; consider rate limits",
    `${CUSTOM}/api/analytics/event`,
  );

  // ---- Step 9: Multilingual ----
  console.log("[audit] Step 9 — multilingual");
  const locales = SUPPORTED_LANGUAGES.filter((l) => l !== PRIMARY_LANGUAGE);
  const localeHubs = await mapPool(locales, 5, async (locale) => {
    const r = await fetchText(`${CUSTOM}/${locale}/kaomoji`);
    return { locale, status: r.status, ms: r.ms, title: extractTitle(r.text), h1: extractH1(r.text), canonical: extractCanonical(r.text) };
  });

  for (const h of localeHubs) {
    // 404 may be ok if dataset gate — but production should have data
    if (h.status !== 200 && h.status !== 404) {
      add("step9", "HIGH", `locale hub ${h.locale}`, "200|404", String(h.status), `ms=${h.ms}`, "Investigate locale hub", `${CUSTOM}/${h.locale}/kaomoji`);
    }
  }

  const searchResults: unknown[] = [];
  for (const [lang, queries] of Object.entries(MULTILINGUAL_QUERIES)) {
    for (const q of queries) {
      const url = `${CUSTOM}/api/kaomoji/search?q=${encodeURIComponent(q)}&locale=${lang}&limit=10`;
      const r = await fetchJson(url);
      const data = r.data as { results?: unknown[]; items?: unknown[]; total?: number } | null;
      const count = Array.isArray(data?.results) ? data!.results!.length : Array.isArray(data?.items) ? data!.items!.length : 0;
      searchResults.push({ lang, q, status: r.status, ms: r.ms, count });
      if (r.status >= 500) {
        add("step9", "HIGH", `search ${lang}:${q}`, "non-5xx", String(r.status), r.text.slice(0, 120), "Fix multilingual search", url);
      }
      // For controlled mappings of emotion words, expect some hits on major langs when EN synonym maps
      if (r.status === 200 && count === 0 && ["happy", "love", "cute", "feliz", "amor", "lindo", "嬉しい", "사랑", "开心", "खुश"].includes(q)) {
        add("step9", "MEDIUM", `empty search ${lang}:${q}`, ">=1 results for core emotion", "0", `ms=${r.ms}`, "Verify synonym/mapping coverage", url);
      }
    }
  }

  // Translation mapping spot-check (source-controlled list)
  let mappingWrong = 0;
  const expectedPairs: Array<[string, string]> = [
    ["feliz", "happy"],
    ["lindo", "cute"],
    ["amor", "love"],
    ["खुश", "happy"],
    ["愛", "love"],
    ["사랑", "love"],
    ["拥抱", "hug"],
  ];
  for (const [term, en] of expectedPairs) {
    const hit = LOCALIZED_SEARCH_TERMS.find((t) => t.term === term || t.term.toLowerCase() === term.toLowerCase());
    const tokens = hit?.englishTokens?.join(",") ?? "";
    if (!hit || !tokens.toLowerCase().includes(en)) {
      mappingWrong++;
      add("step9", "HIGH", `mapping ${term}→${en}`, en, tokens || "missing", "LOCALIZED_SEARCH_TERMS", "Fix or remove incorrect mapping");
    }
  }
  if (LOCALIZED_SEARCH_TERMS.length < 80) {
    add("step9", "MEDIUM", "mapping coverage", ">=80 controlled terms", String(LOCALIZED_SEARCH_TERMS.length), "LOCALIZED_SEARCH_TERMS", "Expand controlled glossary carefully");
  }

  // Autocomplete
  const suggest = await fetchJson(`${CUSTOM}/api/kaomoji/search/suggest?q=ha&locale=en`);
  if (suggest.status >= 500) {
    add("step9", "HIGH", "suggest API", "non-5xx", String(suggest.status), suggest.text.slice(0, 120), "Fix suggest endpoint");
  }

  // ---- Step 10: Personal collections ----
  console.log("[audit] Step 10 — personal");
  const myPage = await fetchText(`${CUSTOM}/kaomoji/my`);
  const myRobots = extractRobots(myPage.text);
  const myCanonical = extractCanonical(myPage.text);
  if (myPage.status !== 200) {
    add("step10", "HIGH", "/kaomoji/my", "200", String(myPage.status), "", "Fix personal library page", `${CUSTOM}/kaomoji/my`);
  }
  if (!/noindex/i.test(myRobots)) {
    add("step10", "CRITICAL", "personal page robots", "noindex", myRobots || "missing", "HTML robots meta", "Force noindex on personal collections", `${CUSTOM}/kaomoji/my`);
  }

  // Resolve API — only public IDs
  const resolveOk = await fetchJson(`${CUSTOM}/api/kaomoji/personal/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: ["kao-00013e7cc777f411", "kao-000231c85784b630"] }),
  });
  const resolveBlocked = await fetchJson(`${CUSTOM}/api/kaomoji/personal/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: BLOCKED_CANDIDATES }),
  });
  const resolveXss = await fetchJson(`${CUSTOM}/api/kaomoji/personal/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: ["<script>alert(1)</script>", "' OR 1=1 --"] }),
  });
  const resolveOversize = await fetchJson(`${CUSTOM}/api/kaomoji/personal/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: Array.from({ length: 200 }, (_, i) => `kao-${i.toString(16).padStart(16, "0")}`) }),
  });

  if (resolveOk.status >= 500) add("step10", "HIGH", "personal resolve valid", "non-5xx", String(resolveOk.status), resolveOk.text.slice(0, 150), "Fix resolve API");
  if (resolveXss.status >= 500) add("step10", "HIGH", "personal resolve XSS ids", "safe 4xx", String(resolveXss.status), resolveXss.text.slice(0, 150), "Validate IDs safely");
  if (resolveOversize.status === 200) {
    // may reject or truncate — INFO if truncated, MEDIUM if silently accepts all 200
    const data = resolveOversize.data as { items?: unknown[]; records?: unknown[] } | null;
    const n = Array.isArray(data?.items) ? data!.items!.length : Array.isArray(data?.records) ? data!.records!.length : -1;
    if (n > 100) {
      add("step10", "MEDIUM", "personal resolve oversize", "<=100 ids", String(n), "POST 200 ids", "Enforce max 100 IDs");
    }
  }
  // Blocked must not hydrate
  {
    const blob = JSON.stringify(resolveBlocked.data ?? {});
    for (const b of BLOCKED_CANDIDATES) {
      if (blob.includes(b) && /"content"|"slug"/.test(blob)) {
        // weak signal — only flag if content returned for blocked
        add("step10", "CRITICAL", `blocked resolve ${b}`, "not hydrated", "appears in resolve response", blob.slice(0, 400), "Never return blocked records from resolve");
      }
    }
  }

  // ---- Step 11: SEO long-tail ----
  console.log("[audit] Step 11 — SEO pages");
  const meaningPages = await mapPool([...MEANING_PAGE_SLUGS], 5, async (slug) => {
    const path = `/kaomoji/meaning/${slug}`;
    const r = await fetchText(`${CUSTOM}${path}`);
    return { slug, path, status: r.status, ms: r.ms, title: extractTitle(r.text), h1: extractH1(r.text), desc: extractMetaDesc(r.text), canonical: extractCanonical(r.text), robots: extractRobots(r.text), jsonLd: hasJsonLd(r.text), cards: countKaomojiCards(r.text), thin: r.text.length < 1500 };
  });
  const useCasePages = await mapPool([...USE_CASE_PAGE_SLUGS], 5, async (slug) => {
    const path = `/kaomoji/for/${slug}`;
    const r = await fetchText(`${CUSTOM}${path}`);
    return { slug, path, status: r.status, ms: r.ms, title: extractTitle(r.text), h1: extractH1(r.text), desc: extractMetaDesc(r.text), canonical: extractCanonical(r.text), robots: extractRobots(r.text), jsonLd: hasJsonLd(r.text), cards: countKaomojiCards(r.text), thin: r.text.length < 1500 };
  });

  const seoPages = [...meaningPages, ...useCasePages, ...intentResults.map((p) => ({ ...p, path: `/kaomoji/${p.slug}`, cards: p.cardCount, thin: p.htmlLen < 1500, desc: p.description }))];
  const titles = new Map<string, string[]>();
  for (const p of seoPages) {
    const url = `${CUSTOM}${p.path}`;
    if (p.status !== 200) {
      add("step11", "HIGH", `SEO page ${p.path}`, "200", String(p.status), `ms=${p.ms}`, "Fix SEO page", url);
      continue;
    }
    if (!p.h1) add("step11", "MEDIUM", `H1 ${p.path}`, "present", "missing", p.title, "Add H1", url);
    if (!("canonical" in p) || !(p as { canonical?: string }).canonical) {
      add("step11", "MEDIUM", `canonical ${p.path}`, "present", "missing", "", "Add canonical", url);
    }
    if ((p as { thin?: boolean }).thin && (p as { cards?: number }).cards! < 3) {
      add("step11", "MEDIUM", `thin page ${p.path}`, "substantial content", `thin=${(p as { thin?: boolean }).thin} cards=${(p as { cards?: number }).cards}`, `html short`, "Enrich or noindex thin pages", url);
    }
    const t = p.title;
    if (t) {
      const list = titles.get(t) ?? [];
      list.push(p.path);
      titles.set(t, list);
    }
  }
  for (const [title, paths] of titles) {
    if (paths.length > 1) {
      add("step11", "MEDIUM", "duplicate SEO titles", "unique titles", `${paths.length} share title`, `${title} → ${paths.join(", ")}`, "Differentiate titles");
    }
  }

  // Sitemap vs SEO inventory spot-check
  for (const slug of MEANING_PAGE_SLUGS.slice(0, 5)) {
    const loc = `https://emojiquick.com/kaomoji/meaning/${slug}`;
    if (!uniqueSitemap.has(loc)) {
      add("step11", "MEDIUM", `sitemap missing ${loc}`, "present in sitemap", "absent", "sitemap.xml", "Add indexable SEO URLs to sitemap", loc);
    }
  }

  // ---- Step 12: Events ----
  console.log("[audit] Step 12 — events");
  const eventsIndex = await fetchText(`${CUSTOM}/kaomoji/events`);
  if (eventsIndex.status !== 200) {
    add("step12", "HIGH", "events index", "200", String(eventsIndex.status), "", "Fix events index", `${CUSTOM}/kaomoji/events`);
  }
  const eventPages = await mapPool([...EVENT_PAGE_SLUGS], 4, async (slug) => {
    const path = `/kaomoji/events/${slug}`;
    const r = await fetchText(`${CUSTOM}${path}`);
    const upcomingClaim = /\b(upcoming|today|happening now|this year'?s event is)\b/i.test(r.text);
    const yearDup = /\/kaomoji\/events\/[^"']+\/20\d{2}/.test(r.text);
    return {
      slug,
      status: r.status,
      ms: r.ms,
      title: extractTitle(r.text),
      h1: extractH1(r.text),
      desc: extractMetaDesc(r.text),
      canonical: extractCanonical(r.text),
      jsonLd: hasJsonLd(r.text),
      cards: countKaomojiCards(r.text),
      upcomingClaim,
      yearDup,
      htmlLen: r.text.length,
    };
  });

  for (const e of eventPages) {
    const url = `${CUSTOM}/kaomoji/events/${e.slug}`;
    if (e.status !== 200) {
      add("step12", "HIGH", `event ${e.slug}`, "200", String(e.status), `ms=${e.ms}`, "Fix event page", url);
      continue;
    }
    if (!e.h1) add("step12", "MEDIUM", `event H1 ${e.slug}`, "present", "missing", e.title, "Add H1", url);
    if (e.cards < 1) add("step12", "HIGH", `event content ${e.slug}`, ">=1 kaomoji", "0", `htmlLen=${e.htmlLen}`, "Ensure event pages load relevant kaomoji", url);
    if (!e.canonical.includes(`/kaomoji/events/${e.slug}`)) {
      add("step12", "MEDIUM", `event canonical ${e.slug}`, `…/events/${e.slug}`, e.canonical || "missing", "", "Fix canonical", url);
    }
    if (e.yearDup) add("step12", "MEDIUM", `yearly URL dup ${e.slug}`, "no year-stamped event URLs", "year path detected", "", "Avoid yearly duplicate URLs", url);
  }

  // Date accuracy spot-checks (independent)
  // Thanksgiving 2026 = Nov 26; Christmas Dec 25; New Year Jan 1; Valentine Feb 14; Halloween Oct 31
  const thanksgiving = await fetchText(`${CUSTOM}/kaomoji/events/thanksgiving`);
  if (thanksgiving.status === 200) {
    // Should not claim wrong fixed date like Nov 25 always
    if (/November 25/i.test(thanksgiving.text) && !/fourth Thursday|4th Thursday|movable/i.test(thanksgiving.text)) {
      add("step12", "HIGH", "Thanksgiving date accuracy", "movable US holiday (4th Thursday)", "possible fixed Nov 25 claim", thanksgiving.text.match(/November[^.<]{0,40}/)?.[0] ?? "", "Describe as US movable holiday", `${CUSTOM}/kaomoji/events/thanksgiving`);
    }
  }

  // ---- Blocked record leak tests ----
  console.log("[audit] blocked leak tests");
  for (const slug of BLOCKED_CANDIDATES) {
    const page = await fetchText(`${CUSTOM}/kaomoji/${slug}`);
    if (page.status === 200) {
      add("security", "CRITICAL", `blocked/invalid detail served ${slug}`, "404", "200", `title=${extractTitle(page.text)}`, "Do not serve blocked records", `${CUSTOM}/kaomoji/${slug}`);
    }
    const search = await fetchJson(`${CUSTOM}/api/kaomoji/search?q=${encodeURIComponent(slug)}&limit=20`);
    const blob = JSON.stringify(search.data ?? {});
    if (blob.includes(slug) && /"content"/.test(blob)) {
      add("security", "CRITICAL", `blocked in search ${slug}`, "not returned", "returned", blob.slice(0, 300), "Filter blocked from search");
    }
  }

  // ---- Security payloads ----
  console.log("[audit] security payloads");
  const securityResults: unknown[] = [];
  for (const path of SECURITY_PAYLOADS) {
    let r;
    if (path === "/api/kaomoji/personal/resolve") {
      r = await fetchText(`${CUSTOM}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "<script>alert(1)</script>",
      });
    } else {
      r = await fetchText(`${CUSTOM}${path}`);
    }
    securityResults.push({ path, status: r.status, ms: r.ms });
    if (r.status >= 500) {
      add("security", "HIGH", `payload 5xx ${path}`, "non-5xx", String(r.status), r.text.slice(0, 180), "Harden input validation", `${CUSTOM}${path}`);
    }
    if (/<script>alert\(1\)<\/script>/i.test(r.text) && !/&lt;script&gt;|\\u003c/.test(r.text)) {
      // reflected raw script — XSS risk if executed; Next often escapes
      add("security", "CRITICAL", `reflected XSS ${path}`, "escaped output", "raw script in HTML", r.text.match(/<script>alert\(1\)<\/script>/i)?.[0] ?? "", "Escape user input", `${CUSTOM}${path}`);
    }
    if (/SQLITE_|SQL syntax|stack trace|TypeError:|ReferenceError:/i.test(r.text)) {
      add("security", "HIGH", `error leak ${path}`, "no stack/SQL errors", "leak detected", r.text.match(/SQLITE_|SQL syntax|stack trace|TypeError:|ReferenceError:/i)?.[0] ?? "", "Sanitize errors", `${CUSTOM}${path}`);
    }
  }

  // ---- Cross-feature link walk (subset) ----
  console.log("[audit] cross-feature walk");
  const walkPaths = [
    "/",
    "/kaomoji",
    "/kaomoji/categories",
    "/kaomoji/happy",
    "/kaomoji/cute",
    "/kaomoji/search",
    "/kaomoji/trending",
    "/kaomoji/popular",
    "/kaomoji/events",
    "/kaomoji/events/christmas",
    "/kaomoji/collections",
    "/kaomoji/meaning/happy",
    "/kaomoji/for/discord",
    "/es/kaomoji",
    "/ja/kaomoji",
  ];
  for (const path of walkPaths) {
    const r = await fetchText(`${CUSTOM}${path}`);
    if (r.status >= 500) {
      add("cross", "HIGH", `walk ${path}`, "non-5xx", String(r.status), `ms=${r.ms}`, "Fix broken navigation path", `${CUSTOM}${path}`);
    } else if (r.status === 404 && !path.includes("/es/") && !path.includes("/ja/")) {
      // locale hubs might 404 if not deployed — flag medium for core paths
      add("cross", "HIGH", `walk 404 ${path}`, "200", "404", `ms=${r.ms}`, "Restore missing page", `${CUSTOM}${path}`);
    }
  }

  // Worker comparison for BUILD_ID
  const workerBuild = await fetchText(`${WORKER}/BUILD_ID`);

  // ---- Aggregate report ----
  const severityCount = {
    CRITICAL: findings.filter((f) => f.severity === "CRITICAL").length,
    HIGH: findings.filter((f) => f.severity === "HIGH").length,
    MEDIUM: findings.filter((f) => f.severity === "MEDIUM").length,
    LOW: findings.filter((f) => f.severity === "LOW").length,
    INFO: findings.filter((f) => f.severity === "INFO").length,
  };

  const report = {
    audit: "STEPS_6_12_FIRST_FORENSIC",
    started,
    finished: new Date().toISOString(),
    production: CUSTOM,
    worker: WORKER,
    build_id: buildId,
    worker_build_id: workerBuild.text.trim(),
    baseline_expected: {
      canonical: 63248,
      public: 51338,
      blocked: 11910,
      raw: 236508,
      relationships: 396162,
    },
    source_inventory: {
      taxonomy_groups: TAXONOMY_GROUPS.length,
      taxonomy_categories: EMOJIQUICK_TAXONOMY.length,
      curated_intents: CURATED_INTENT_SLUGS.length,
      events: EVENT_PAGE_SLUGS.length,
      meanings: MEANING_PAGE_SLUGS.length,
      use_cases: USE_CASE_PAGE_SLUGS.length,
      localized_search_terms: LOCALIZED_SEARCH_TERMS.length,
      supported_languages: [...SUPPORTED_LANGUAGES],
      analytics_maturity: ANALYTICS_MATURITY,
    },
    sitemap: {
      status: sm.status,
      url_count: sitemapUrls.length,
      unique_count: uniqueSitemap.size,
      kaomoji_count: kaomojiSitemap.length,
      personal_my_count: myInSitemap.length,
    },
    step6,
    step7: {
      details_tested: detailResults.length,
      self_recommendations: selfRec,
      duplicate_recommendation_responses: dupRec,
      blocked_recommendations: blockedRec,
      pairs_checked: pairsChecked,
      weak_pairs: weakPairs,
      api_performance_ms: {
        min: relatedPerf[0] ?? 0,
        median: pct(50),
        p95: pct(95),
        max: relatedPerf[relatedPerf.length - 1] ?? 0,
        samples: relatedPerf.length,
      },
      samples: relatedSamples,
    },
    step8,
    step9: {
      locale_hubs: localeHubs,
      search_probes: searchResults,
      mapping_wrong: mappingWrong,
      suggest_status: suggest.status,
    },
    step10: {
      my_status: myPage.status,
      my_robots: myRobots,
      my_canonical: myCanonical,
      resolve_ok_status: resolveOk.status,
      resolve_blocked_status: resolveBlocked.status,
      resolve_xss_status: resolveXss.status,
      resolve_oversize_status: resolveOversize.status,
    },
    step11: {
      meaning_pages: meaningPages,
      use_case_pages: useCasePages,
      seo_pages_audited: seoPages.length,
    },
    step12: {
      events_index_status: eventsIndex.status,
      event_pages: eventPages,
    },
    security_results: securityResults,
    severity_count: severityCount,
    findings,
  };

  const finalDir = join(rootDir, "data/kaomoji/processed/final");
  mkdirSync(finalDir, { recursive: true });
  mkdirSync(join(rootDir, "r2-export"), { recursive: true });
  const jsonPath = join(finalDir, "master-steps-6-12-first-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push("# MASTER STEPS 6–12 — FIRST FORENSIC AUDIT");
  md.push("");
  md.push(`- Started: ${started}`);
  md.push(`- Finished: ${report.finished}`);
  md.push(`- Production: ${CUSTOM}`);
  md.push(`- BUILD_ID: \`${buildId}\``);
  md.push(`- Worker BUILD_ID: \`${workerBuild.text.trim()}\``);
  md.push("");
  md.push("## Severity summary");
  md.push("");
  md.push("| Severity | Count |");
  md.push("|---|---|");
  for (const [k, v] of Object.entries(severityCount)) md.push(`| ${k} | ${v} |`);
  md.push("");
  md.push("## Source inventory (independent)");
  md.push("");
  md.push(`- Taxonomy groups: ${TAXONOMY_GROUPS.length}`);
  md.push(`- Taxonomy categories: ${EMOJIQUICK_TAXONOMY.length}`);
  md.push(`- Curated intent pages: ${CURATED_INTENT_SLUGS.length}`);
  md.push(`- Event pages: ${EVENT_PAGE_SLUGS.length}`);
  md.push(`- Meaning pages: ${MEANING_PAGE_SLUGS.length}`);
  md.push(`- Use-case pages: ${USE_CASE_PAGE_SLUGS.length}`);
  md.push(`- Controlled localized terms: ${LOCALIZED_SEARCH_TERMS.length}`);
  md.push(`- Analytics liveEventsEnabled: ${ANALYTICS_MATURITY.liveEventsEnabled}`);
  md.push("");
  md.push("## Sitemap");
  md.push("");
  md.push(`- URLs: ${sitemapUrls.length} (unique ${uniqueSitemap.size}), kaomoji ${kaomojiSitemap.length}`);
  md.push(`- Personal /my in sitemap: ${myInSitemap.length}`);
  md.push("");
  md.push("## Findings");
  md.push("");
  for (const f of findings) {
    md.push(`### ${f.id} — ${f.severity} — ${f.feature}`);
    md.push("");
    md.push(`- Test: ${f.test}`);
    md.push(`- Expected: ${f.expected}`);
    md.push(`- Actual: ${f.actual}`);
    md.push(`- Evidence: ${f.evidence}`);
    if (f.url) md.push(`- URL: ${f.url}`);
    md.push(`- Recommendation: ${f.recommendation}`);
    md.push("");
  }
  md.push("## Next");
  md.push("");
  md.push("Enter FIX phase for all CRITICAL / HIGH / MEDIUM (and meaningful LOW). Do not declare PASS from this report alone.");
  md.push("");

  const mdPath = join(rootDir, "r2-export/MASTER-STEPS-6-12-FIRST-AUDIT.md");
  writeFileSync(mdPath, md.join("\n"));

  console.log(`[audit] wrote ${jsonPath}`);
  console.log(`[audit] wrote ${mdPath}`);
  console.log(`[audit] severity`, severityCount);
  console.log(`[audit] findings=${findings.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
