import type { ImportEntry } from "./types";
import { tableFromIPC } from "apache-arrow";
import {
  extractStringsFromJson,
  fetchGitHubRawJson,
  fetchGitHubRawText,
  parseGenerateKaomojiJson,
  parseKawaiiFacesJs,
} from "./github-repo";
import { fetchPage } from "./fetch-utils";
import type { Phase5ImportResult } from "./phase5-sources";

const UA = "EmojiQuick-Phase6/1.0 (research; local development)";

export type Phase6ImportResult = Phase5ImportResult & {
  readonly templates_only?: boolean;
  readonly template_metadata?: Record<string, unknown> | null;
};

/** Parse 6/kaomoji-json kao-utf8.json — numeric keys with { face, annotation }. */
export function parseKaomojiJsonFaceRecords(payload: unknown, sourceFile: string, sourcePage: string | null): ImportEntry[] {
  const entries: ImportEntry[] = [];
  if (!payload || typeof payload !== "object") return entries;
  let idx = 0;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const obj = value as Record<string, unknown>;
    const face = typeof obj.face === "string" ? obj.face.trim() : "";
    if (!face) continue;
    const annotation = typeof obj.annotation === "string" ? obj.annotation.trim() : null;
    entries.push({
      original_kaomoji: face,
      source_record_id: `${sourceFile}:${key}`,
      source_page: sourcePage,
      source_file: sourceFile,
      source_metadata: annotation ? { annotation } : null,
      content_type: "KAOMOJI",
      occurrence_index: idx++,
    });
  }
  return entries;
}

export async function fetchKaomojiJsonPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  let files = 0;
  const attempts: Array<{ owner: string; repo: string; branch: string; status: string }> = [];

  for (const [owner, repo, branch, filePaths] of [
    ["6", "kaomoji-json", "master", ["kao-utf8.json", "kao-shiftjis.json"]],
    ["chengxuncc", "kaomoji-json", "main", ["kaomoji.json", "data.json"]],
  ] as const) {
    let found = false;
    for (const filePath of filePaths) {
      const payload = await fetchGitHubRawJson(owner, repo, filePath, branch, fetchFn);
      if (!payload) continue;
      files += 1;
      found = true;
      const page = `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
      if (filePath.includes("kao-")) {
        entries.push(...parseKaomojiJsonFaceRecords(payload, filePath, page));
      } else {
        entries.push(...extractStringsFromJson(payload, { source_file: filePath, source_page: page }, { idPrefix: `kj:${filePath}` }));
      }
    }
    attempts.push({ owner, repo, branch, status: found ? "RECOVERED" : "NOT_FOUND" });
    if (entries.length > 0) break;
  }

  return {
    entries,
    pages_discovered: attempts.length,
    pages_processed: files,
    files_processed: files,
    errors: entries.length ? [] : ["chengxuncc/kaomoji-json: 404; continuation: 6/kaomoji-json (kao-utf8.json)"],
  };
}

export async function fetchKaomojiCaptionPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const arrowUrl = "https://huggingface.co/datasets/mrzjy/kaomoji_caption/resolve/main/train/data-00000-of-00001.arrow";
  const datasetUrl = "https://huggingface.co/datasets/mrzjy/kaomoji_caption";
  const res = await fetchFn(arrowUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    errors.push(`arrow download ${res.status}`);
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const table = tableFromIPC(buf);
  const kaomojiCol = table.getChild("kaomoji");
  const captionCol = table.getChild("caption");
  const metaCol = table.getChild("meta");
  if (!kaomojiCol) {
    errors.push("missing kaomoji column");
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 1, errors };
  }
  for (let i = 0; i < table.numRows; i++) {
    const k = String(kaomojiCol.get(i) ?? "").trim();
    if (!k) continue;
    const caption = captionCol ? String(captionCol.get(i) ?? "").trim() : "";
    const meta = metaCol ? metaCol.get(i) : null;
    entries.push({
      original_kaomoji: k,
      source_record_id: `hf:train:${i}`,
      source_page: datasetUrl,
      source_file: "train/data-00000-of-00001.arrow",
      source_metadata: {
        ...(caption ? { caption } : {}),
        split: "train",
        row_index: String(i),
        license: "CC-BY-4.0",
        dataset_version: "mrzjy/kaomoji_caption",
      },
      content_type: "KAOMOJI",
      license_status: "ATTRIBUTION_REQUIRED",
      occurrence_index: i,
    });
  }
  return { entries, pages_discovered: table.numRows, pages_processed: 1, files_processed: 1, errors };
}

const JEO_BASE = "https://japaneseemoticons.org";
const JEO_SKIP = new Set(["Copied", "Copy", "copy", ""]);

function isKaomojiLike(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 120) return false;
  if (JEO_SKIP.has(t)) return false;
  if (/^(Loud laughter|Apology|Greeting|Happy|Sad|Love|Anger|Fear|Surprise|Dream|Shy|Sick|Wink)/i.test(t)) return false;
  return /[^\w\s]/.test(t);
}

export function extractJapaneseEmoticonsFromHtml(html: string, pageUrl: string, category: string, startIdx: number): ImportEntry[] {
  const entries: ImportEntry[] = [];
  let idx = startIdx;
  const patterns = [
    /class="[^"]*kaomoji[^"]*"[^>]*>([^<]+)</gi,
    /class="[^"]*emoticon-item[^"]*"[^>]*>([^<]+)</gi,
    /data-kaomoji="([^"]+)"/gi,
    /data-emoticon="([^"]+)"/gi,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const t = m[1]!.trim();
      if (!isKaomojiLike(t)) continue;
      entries.push({
        original_kaomoji: t,
        source_record_id: `jeo:${category}:${idx}`,
        source_page: pageUrl,
        source_category: category,
        content_type: "KAOMOJI",
        occurrence_index: idx++,
      });
    }
  }
  return entries;
}

export async function discoverJapaneseEmoticonsOrgPages(fetchFn: typeof fetch = fetch): Promise<string[]> {
  const urls = new Set<string>([`${JEO_BASE}/all-collections/`]);
  const sm = await fetchFn(`${JEO_BASE}/sitemap.xml`, { headers: { "User-Agent": UA } });
  if (sm.ok) {
    const xml = await sm.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const sub = m[1]!;
      if (sub.includes("sitemap.t_en_pages")) {
        const subRes = await fetchFn(sub, { headers: { "User-Agent": UA } });
        if (subRes.ok) {
          for (const loc of (await subRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(loc[1]!);
        }
      } else {
        urls.add(sub);
      }
    }
  }
  const allColl = await fetchFn(`${JEO_BASE}/all-collections/`, { headers: { "User-Agent": UA } });
  if (allColl.ok) {
    const html = await allColl.text();
    for (const m of html.matchAll(/href="(\/collection-of-kaomoji-[^"]+)"/g)) {
      urls.add(`${JEO_BASE}${m[1]}`);
    }
  }
  return [...urls].filter((u) => !u.includes("/404/") && !u.includes("privacy-policy"));
}

export async function fetchJapaneseEmoticonsOrgPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const pageUrls = await discoverJapaneseEmoticonsOrgPages(fetchFn);
  let processed = 0;
  let idx = 0;
  for (const pageUrl of pageUrls) {
    try {
      const res = await fetchFn(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
      processed += 1;
      if (!res.ok) {
        errors.push(`${pageUrl}: ${res.status}`);
        continue;
      }
      const html = await res.text();
      const category = pageUrl.replace(JEO_BASE, "").replace(/^\//, "").replace(/\/$/, "") || "index";
      const pageEntries = extractJapaneseEmoticonsFromHtml(html, pageUrl, category, idx);
      idx += pageEntries.length;
      entries.push(...pageEntries);
    } catch (err) {
      errors.push(`${pageUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { entries, pages_discovered: pageUrls.length, pages_processed: processed, files_processed: 0, errors };
}

/** Parse npm kaomoji (vaneenige) bundled JS category arrays. */
export function parseNpmKaomojiBundle(text: string, sourceFile: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  let idx = 0;
  for (const m of text.matchAll(/const\s+(\w+)\$\d+\s*=\s*(\[[\s\S]*?\]);/g)) {
    const category = m[1]!;
    const arrText = m[2]!;
    try {
      const arr = JSON.parse(arrText.replace(/'/g, '"')) as unknown;
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, i) => {
        if (typeof item === "string" && item.trim()) {
          entries.push({
            original_kaomoji: item.trim(),
            source_record_id: `npm:${category}:${i}`,
            source_category: category,
            source_file: sourceFile,
            source_page: "https://www.npmjs.com/package/kaomoji",
            content_type: "KAOMOJI",
            occurrence_index: idx++,
          });
        }
      });
    } catch {
      for (const s of arrText.matchAll(/['"]([^'"]{2,120})['"]/g)) {
        const t = s[1]!.trim();
        if (/[^\w\s]/.test(t)) {
          entries.push({
            original_kaomoji: t,
            source_record_id: `npm:${category}:${idx}`,
            source_category: category,
            source_file: sourceFile,
            source_page: "https://www.npmjs.com/package/kaomoji",
            content_type: "KAOMOJI",
            occurrence_index: idx++,
          });
        }
      }
    }
  }
  return entries;
}

export async function fetchNpmKaomojiPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const errors: string[] = [];
  const npmRes = await fetchFn("https://registry.npmjs.org/kaomoji/latest", { headers: { "User-Agent": UA } });
  if (!npmRes.ok) {
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors: ["npm package 404"] };
  }
  const pkg = (await npmRes.json()) as { version?: string; dist?: { tarball?: string } };
  const bundle = await fetchFn("https://unpkg.com/kaomoji@0.2.1/index.cjs.js", { headers: { "User-Agent": UA } });
  if (!bundle.ok) {
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors: [`bundle ${bundle.status}`] };
  }
  const text = await bundle.text();
  const entries = parseNpmKaomojiBundle(text, "index.cjs.js");
  if (entries.length === 0) errors.push("no embedded arrays found — generator-only package");
  return {
    entries,
    pages_discovered: 1,
    pages_processed: 1,
    files_processed: 1,
    errors,
    template_metadata: entries.length === 0 ? { package_version: pkg.version, tarball: pkg.dist?.tarball } : null,
  };
}

export async function fetchGenerateKaomojiPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const payload = await fetchGitHubRawJson("xav-ie", "generate-kaomoji", "kaomoji.json", "main", fetchFn);
  const entries = payload ? parseGenerateKaomojiJson(payload, "kaomoji.json") : [];
  return {
    entries,
    pages_discovered: 757,
    pages_processed: payload ? 1 : 0,
    files_processed: payload ? 1 : 0,
    errors: payload ? [] : ["kaomoji.json missing"],
  };
}

export async function fetchKawaiiFacesPhase6(fetchFn: typeof fetch = fetch): Promise<Phase6ImportResult> {
  const files = ["src/data/happy.js", "src/data/love.js", "src/data/mad.js", "src/data/sad.js"];
  const entries: ImportEntry[] = [];
  let processed = 0;
  for (const file of files) {
    const text = await fetchGitHubRawText("matthewsimo", "kawaii-faces", file, "master", fetchFn);
    if (!text) continue;
    processed += 1;
    const cat = file.replace("src/data/", "").replace(".js", "");
    entries.push(...parseKawaiiFacesJs(text, cat, file));
  }
  return { entries, pages_discovered: files.length, pages_processed: processed, files_processed: processed, errors: processed ? [] : ["no data files"] };
}

export async function probeTextEmoticons(fetchFn: typeof fetch = fetch): Promise<{ accessible: boolean; status: number; errors: string[] }> {
  const urls = ["https://textemoticons.com/", "https://www.textemoticons.com/", "http://textemoticons.com/"];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetchFn(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return { accessible: true, status: res.status, errors: [] };
      errors.push(`${url}: ${res.status}`);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { accessible: false, status: 0, errors };
}

export async function probeSlangIt(fetchFn: typeof fetch = fetch): Promise<{ accessible: boolean; status: number; errors: string[] }> {
  const urls = ["https://slangit.com/", "https://www.slangit.com/emoticons", "https://slangit.com/emoticons"];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetchFn(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return { accessible: true, status: res.status, errors: [] };
      errors.push(`${url}: ${res.status}`);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { accessible: false, status: 0, errors };
}

export async function searchJapaneseEmoticonsRecovery(fetchFn: typeof fetch = fetch): Promise<{
  status: "INACCESSIBLE" | "RECOVERED";
  repository: string | null;
  entries: ImportEntry[];
  errors: string[];
}> {
  const candidates = [
    ["roodcode", "japanese-emoticons", "master"],
    ["roodcode", "japanese-emoticons", "main"],
  ] as const;
  for (const [owner, repo, branch] of candidates) {
    const payload = await fetchGitHubRawJson(owner, repo, "emoticons.json", branch, fetchFn)
      ?? await fetchGitHubRawJson(owner, repo, "index.json", branch, fetchFn);
    if (payload) {
      return {
        status: "RECOVERED",
        repository: `https://github.com/${owner}/${repo}`,
        entries: extractStringsFromJson(payload, { source_file: "emoticons.json", source_page: `https://github.com/${owner}/${repo}` }, { idPrefix: "je" }),
        errors: [],
      };
    }
  }
  return { status: "INACCESSIBLE", repository: null, entries: [], errors: ["roodcode/japanese-emoticons: 404 — no verified continuation"] };
}
