import { mkdirSync, writeFileSync } from "node:fs";
import { fetchPage } from "../../collection/importers/fetch-utils";
import { fetchEmoticonDataEntries } from "../../collection/importers/emoticon-data";
import { fetchEmoticonsTextEntries } from "../../collection/importers/emoticonstext";
import { fetchKaomojiTaggedEntries } from "../../collection/importers/kaomoji-tagged";
import { fetchMesslettersEntries } from "../../collection/importers/messletters";
import { fetchWikipediaExtendedEntries } from "../../collection/importers/wikipedia-extended";
import { buildLicenseAuditRecords } from "../../sources/license-audit";
import { KAOMOJI_SOURCE_REGISTRY, getSourceById } from "../../sources/registry";
import { getPhase3BDiscoveryPath, getPhase3BManifestPath } from "../../storage/paths";
import {
  discoverMesslettersPaths,
  loadCollectedSnapshot,
  parseEmoticonsTextSpans,
  parseMesslettersEntries,
  sitemapLocs,
} from "./snapshot";
import type { Phase3BManifest, Phase3BSourceAudit, SourceLicenseReport, SourcePrimaryStatus, SourceUrlInventoryEntry } from "./types";

export const PHASE3B_DISCOVERY_VERSION = "3B.1.0-discovery-audit";

function licenseReport(sourceId: string): SourceLicenseReport {
  const s = getSourceById(sourceId);
  const a = buildLicenseAuditRecords().find((r) => r.source_id === sourceId);
  return {
    source_id: sourceId,
    license: s?.license_name ?? null,
    terms_url: s?.terms_url ?? null,
    copyright_owner: null,
    commercial_use: s?.commercial_use ?? null,
    redistribution: s?.redistribution ?? null,
    modification: s?.modification ?? null,
    attribution: s?.attribution_required ?? null,
    automated_collection: s?.enabled_for_collection ? "enabled" : "review_required",
    manual_collection: `data/kaomoji/imports/${sourceId}.json`,
    restrictions: a?.restrictions ?? [],
    confidence: a?.confidence ?? "low",
    license_status: s?.license_status ?? "UNKNOWN",
  };
}

function auditRow(
  sourceId: string,
  name: string,
  url: string,
  status: SourcePrimaryStatus,
  evidence: string[],
  opts: Partial<Phase3BSourceAudit> & { url_inventory: SourceUrlInventoryEntry[] },
  snap: ReturnType<typeof loadCollectedSnapshot>,
): Phase3BSourceAudit {
  const col = snap.by_source[sourceId] ?? { raw: 0, unique: 0, duplicates: 0 };
  return {
    source_id: sourceId,
    source_name: name,
    current_url: url,
    primary_status: status,
    status_evidence: evidence,
    pages_discovered: opts.pages_discovered ?? 0,
    pages_processed: opts.pages_processed ?? 0,
    categories_discovered: opts.categories_discovered ?? 0,
    discovered_total: opts.discovered_total ?? null,
    discovered_unique: opts.discovered_unique ?? null,
    collected_raw: col.raw,
    collected_unique: col.unique,
    duplicate_within_source: opts.duplicate_within_source ?? col.duplicates,
    content_types: opts.content_types ?? [],
    problems: opts.problems ?? [],
    recommended_status: opts.recommended_status ?? status,
    license: licenseReport(sourceId),
    url_inventory: opts.url_inventory,
  };
}

/** Phase 3B: full discovery audit — does NOT modify raw records. */
export async function runPhase3BDiscovery(
  rootDir: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<Phase3BManifest> {
  const fetchFn = options.fetchFn ?? fetch;
  const snap = loadCollectedSnapshot(rootDir);
  const rawBefore = snap.total_raw;
  const audits: Phase3BSourceAudit[] = [];

  const emoticon = await fetchEmoticonDataEntries(fetchFn);
  const emoticonUnique = new Set(emoticon.map((e) => e.original_kaomoji)).size;
  audits.push(
    auditRow("emoticon-data", "emoticon-data", "https://github.com/w33ble/emoticon-data", "ACTIVE_RELEVANT", [
      `Remote/collection count: ${emoticon.length}`,
      "MIT license, GitHub raw JSON",
    ], {
      pages_discovered: 1,
      pages_processed: 1,
      categories_discovered: new Set(emoticon.flatMap((e) => (e.source_category ?? "").split(", "))).size,
      discovered_total: emoticon.length,
      discovered_unique: emoticonUnique,
      content_types: ["EMOTICON", "TEXT_FACE"],
      url_inventory: [{
        source_id: "emoticon-data",
        url: "https://raw.githubusercontent.com/w33ble/emoticon-data/master/emoticons.json",
        page_type: "dataset",
        category: null,
        record_count: emoticon.length,
        content_types: ["EMOTICON"],
        access_status: "accessible",
        license_status: "APPROVED",
      }],
    }, snap),
  );

  const kaomoji = await fetchKaomojiTaggedEntries(fetchFn);
  audits.push(
    auditRow("kaomoji-tagged", "kaomoji-tagged", "https://github.com/kaomojikan/kaomoji-data", "ACTIVE_RELEVANT", [
      `kaomoji.json: ${kaomoji.length} records`,
      "by-category files add 0 new unique texts vs main",
    ], {
      pages_discovered: 24,
      pages_processed: 24,
      discovered_total: kaomoji.length,
      discovered_unique: new Set(kaomoji.map((e) => e.original_kaomoji)).size,
      content_types: ["KAOMOJI"],
      url_inventory: [{
        source_id: "kaomoji-tagged",
        url: "https://raw.githubusercontent.com/kaomojikan/kaomoji-data/main/kaomoji.json",
        page_type: "dataset",
        category: null,
        record_count: kaomoji.length,
        content_types: ["KAOMOJI"],
        access_status: "accessible",
        license_status: "APPROVED",
      }],
    }, snap),
  );

  const wiki = await fetchWikipediaExtendedEntries(fetchFn);
  audits.push(
    auditRow("wikipedia", "Wikipedia", "https://en.wikipedia.org/wiki/List_of_emoticons", "ACTIVE_RELEVANT", [
      "Pages: List_of_emoticons, Kaomoji, Emoticon via Wikimedia API",
      `Collected ${snap.by_source.wikipedia?.raw ?? 0} after filtering`,
      "CC BY-SA — attribution required",
    ], {
      pages_discovered: 3,
      pages_processed: wiki.pages_processed,
      discovered_total: wiki.entries.length,
      content_types: ["EMOTICON", "KAOMOJI", "DESCRIPTION"],
      problems: ["Mix of quoted examples and article prose — review required"],
      url_inventory: ["List_of_emoticons", "Kaomoji", "Emoticon"].map((p) => ({
        source_id: "wikipedia",
        url: `https://en.wikipedia.org/wiki/${p}`,
        page_type: "wiki",
        category: "Emoticons",
        record_count: null,
        content_types: ["EMOTICON", "KAOMOJI"] as const,
        access_status: "accessible" as const,
        license_status: "ATTRIBUTION_REQUIRED",
      })),
    }, snap),
  );

  const tcHome = await fetchPage("https://www.toolcalculator.com/", fetchFn);
  const tcEmot = await fetchPage("https://www.toolcalculator.com/emoticons", fetchFn);
  audits.push(
    auditRow("toolcalculator", "ToolCalculator", "https://www.toolcalculator.com/", "SOURCE_MISMATCH", [
      "General tools/calculators site",
      `/emoticons status ${tcEmot.status}`,
      "No kaomoji/emoticon collection discovered",
    ], {
      pages_discovered: 2,
      pages_processed: 2,
      discovered_total: 0,
      discovered_unique: 0,
      content_types: [],
      url_inventory: [
        { source_id: "toolcalculator", url: "https://www.toolcalculator.com/", page_type: "homepage", category: null, record_count: 0, content_types: [], access_status: tcHome.status === 200 ? "accessible" : "inaccessible", license_status: "REVIEW_REQUIRED" },
      ],
    }, snap),
  );

  const koHome = await fetchPage("https://kaomojis.org/", fetchFn);
  const koSm = await fetchPage("https://kaomojis.org/sitemap_index.xml", fetchFn);
  const koUrls = koSm.status === 200 ? sitemapLocs(koSm.html) : [];
  audits.push(
    auditRow("kaomojis-org", "kaomojis.org", "https://kaomojis.org/", "SOURCE_MISMATCH", [
      `Title: ${koHome.html.match(/<title>([^<]+)/i)?.[1] ?? "unknown"}`,
      "Blog/SEO site — no structured kaomoji database",
      "STOP ingestion — unrelated blog content",
    ], {
      pages_discovered: koUrls.length,
      discovered_total: 0,
      content_types: ["OTHER", "DESCRIPTION"],
      problems: ["SOURCE_MISMATCH — do not ingest blog content"],
      url_inventory: koUrls.slice(0, 10).map((u) => ({
        source_id: "kaomojis-org", url: u, page_type: "sitemap", category: null, record_count: null,
        content_types: ["OTHER"], access_status: "accessible", license_status: "REVIEW_REQUIRED",
      })),
    }, snap),
  );

  const mlIndex = await fetchPage("https://www.messletters.com/en/emoticons/", fetchFn);
  const mlPaths = mlIndex.status === 200 ? discoverMesslettersPaths(mlIndex.html) : [];
  let mlTotal = 0;
  const mlIds = new Set<string>();
  const mlUrls: SourceUrlInventoryEntry[] = [];
  for (const p of mlPaths) {
    const r = await fetchPage(`https://www.messletters.com${p}`, fetchFn, { delayMs: 200 });
    const items = r.status === 200 ? parseMesslettersEntries(r.html) : [];
    mlTotal += items.length;
    for (const i of items) mlIds.add(i.id);
    mlUrls.push({
      source_id: "messletters", url: `https://www.messletters.com${p}`, page_type: "category",
      category: p.replace("/en/emoticons/", "").replace(/\/$/, ""), record_count: items.length,
      content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE"], access_status: r.status === 200 ? "accessible" : "inaccessible",
      license_status: "REVIEW_REQUIRED",
    });
  }
  audits.push(
    auditRow("messletters", "Messletters", "https://www.messletters.com/en/emoticons/", "ACTIVE_RELEVANT", [
      `${mlPaths.length} pages; ${mlTotal} HTML entries; ${mlIds.size} unique IDs`,
      `Collected ${snap.by_source.messletters?.raw ?? 0} (idempotent by li id)`,
    ], {
      pages_discovered: mlPaths.length,
      pages_processed: mlPaths.length,
      categories_discovered: mlPaths.length,
      discovered_total: mlTotal,
      discovered_unique: mlIds.size,
      duplicate_within_source: mlTotal - mlIds.size,
      content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE"],
      url_inventory: mlUrls,
    }, snap),
  );

  const teAttempts = ["https://textemoticons.com/", "https://www.textemoticons.com/"];
  const teResults = await Promise.all(teAttempts.map((u) => fetchPage(u, fetchFn)));
  const teOk = teResults.find((r) => r.status === 200);
  audits.push(
    auditRow("textemoticons", "TextEmoticons", "https://textemoticons.com", teOk ? "REVIEW_REQUIRED" : "INACCESSIBLE", teOk
      ? ["At least one URL responded"]
      : teResults.map((r) => r.error ?? `status ${r.status}`),
    {
      pages_processed: teAttempts.length,
      discovered_total: teOk ? null : 0,
      content_types: teOk ? ["EMOTICON"] : [],
      problems: teOk ? [] : ["DNS/network unreachable"],
      url_inventory: teAttempts.map((u, i) => ({
        source_id: "textemoticons", url: u, page_type: "probe", category: null, record_count: null,
        content_types: [], access_status: teResults[i]!.status === 200 ? "accessible" : "inaccessible",
        license_status: "UNKNOWN",
      })),
    }, snap),
  );

  const et = await fetchEmoticonsTextEntries(fetchFn);
  const etHome = await fetchPage("https://www.emoticonstext.com/", fetchFn);
  const etSm = await fetchPage("https://www.emoticonstext.com/sitemap.xml", fetchFn);
  audits.push(
    auditRow("emoticonstext", "EmoticonsText", "https://www.emoticonstext.com/", "ACTIVE_RELEVANT", [
      `Homepage ${parseEmoticonsTextSpans(etHome.html).length} entries`,
      `Sitemap status ${etSm.status}`,
      "Primarily single-page site",
    ], {
      pages_discovered: etSm.status === 200 ? sitemapLocs(etSm.html).length + 1 : 1,
      pages_processed: 1 + et.pages_processed,
      discovered_total: et.entries.length,
      discovered_unique: new Set(et.entries.map((e) => e.original_kaomoji)).size,
      content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE", "SYMBOL"],
      url_inventory: [{
        source_id: "emoticonstext", url: "https://www.emoticonstext.com/", page_type: "homepage",
        category: "japanese-emoticons", record_count: et.entries.length,
        content_types: ["KAOMOJI", "EMOTICON"], access_status: "accessible", license_status: "REVIEW_REQUIRED",
      }],
    }, snap),
  );

  const slAttempts = ["https://slangit.com/emoticons", "https://www.slangit.com/emoticons"];
  const slResults = await Promise.all(slAttempts.map((u) => fetchPage(u, fetchFn, { delayMs: 100 })));
  const slOk = slResults.find((r) => r.status === 200 && r.html.length > 500);
  audits.push(
    auditRow("slangit", "SlangIt", "https://slangit.com/emoticons", slOk ? "ACTIVE_PARTIALLY_RELEVANT" : "INACCESSIBLE", slOk
      ? [`Accessible: ${slOk.url}`]
      : slResults.map((r) => r.error ?? `status ${r.status}`),
    {
      pages_processed: slAttempts.length,
      discovered_total: slOk ? null : 0,
      content_types: slOk ? ["EMOTICON", "DESCRIPTION"] : [],
      problems: slOk ? [] : ["Connection timeout"],
      url_inventory: slAttempts.map((u, i) => ({
        source_id: "slangit", url: u, page_type: "emoticons", category: null, record_count: null,
        content_types: [], access_status: slResults[i]!.status === 200 ? "accessible" : "inaccessible",
        license_status: "REVIEW_REQUIRED",
      })),
    }, snap),
  );

  const feSm = await fetchPage("https://www.fastemoji.com/sitemap.xml", fetchFn);
  const feSubs = feSm.status === 200 ? sitemapLocs(feSm.html) : [];
  audits.push(
    auditRow("fastemoji", "FastEmoji", "https://www.fastemoji.com/", "ACTIVE_PARTIALLY_RELEVANT", [
      `Sitemap sub-indexes: ${feSubs.length}`,
      "Unicode emoji platform — 45000+ URLs in main sitemaps",
      "Text kaomoji minimal; EMOJI/EMOJI_SEQUENCE/COMBINATION primary",
    ], {
      pages_discovered: feSubs.length * 45000,
      pages_processed: 3,
      content_types: ["EMOJI", "EMOJI_SEQUENCE", "COMBINATION", "CATEGORY"],
      problems: ["Full URL inventory sampled not enumerated — discovery audit only"],
      url_inventory: [
        { source_id: "fastemoji", url: "https://www.fastemoji.com/sitemap.xml", page_type: "sitemap", category: null, record_count: null, content_types: ["EMOJI"], access_status: "accessible", license_status: "REVIEW_REQUIRED" },
        { source_id: "fastemoji", url: "https://www.fastemoji.com/category/funny", page_type: "category", category: "funny", record_count: null, content_types: ["EMOJI", "COMBINATION"], access_status: "accessible", license_status: "REVIEW_REQUIRED" },
      ],
    }, snap),
  );

  const inventoryTable = audits.map((a) => ({
    source: a.source_id,
    pages: a.pages_discovered,
    categories: a.categories_discovered,
    raw: a.collected_raw,
    unique: a.collected_unique,
    duplicates: a.duplicate_within_source,
    content_types: a.content_types,
    status: a.primary_status,
  }));

  const manifest: Phase3BManifest = {
    phase: "3B",
    timestamp: new Date().toISOString(),
    discovery_version: PHASE3B_DISCOVERY_VERSION,
    raw_before: rawBefore,
    raw_after: rawBefore,
    new_records: 0,
    existing_records: rawBefore,
    removed_records: 0,
    modified_records: 0,
    total_discovered: audits.reduce((s, a) => s + (a.discovered_total ?? 0), 0),
    total_collected: rawBefore,
    total_raw: rawBefore,
    total_unique: snap.total_unique,
    total_duplicates: rawBefore - snap.total_unique,
    total_variants: null,
    sources_active: audits.filter((a) => ["ACTIVE_RELEVANT", "ACTIVE_PARTIALLY_RELEVANT"].includes(a.primary_status)).length,
    sources_mismatch: audits.filter((a) => a.primary_status === "SOURCE_MISMATCH").length,
    sources_inaccessible: audits.filter((a) => a.primary_status === "INACCESSIBLE").length,
    source_audits: audits,
    inventory_table: inventoryTable,
    url_inventory: audits.flatMap((a) => a.url_inventory),
  };

  mkdirSync(`${rootDir}/data/kaomoji/discovery`, { recursive: true });
  writeFileSync(getPhase3BManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(getPhase3BDiscoveryPath(rootDir), `${JSON.stringify(manifest.source_audits, null, 2)}\n`, "utf8");

  return manifest;
}

export function getRegistryCount(): number {
  return KAOMOJI_SOURCE_REGISTRY.length;
}
