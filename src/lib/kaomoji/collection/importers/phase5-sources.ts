import type { ImportEntry } from "./types";
import {
  extractStringsFromJson,
  fetchGitHubRawJson,
  fetchGitHubRawText,
  listGitHubContents,
  parseGenerateKaomojiJson,
  parseKawaiiFacesJs,
  parseRandomKaomojiYaml,
  parseWooormEmoticonAlias,
  probeGitHubRepo,
} from "./github-repo";

export interface Phase5ImportResult {
  readonly entries: ImportEntry[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly files_processed: number;
  readonly errors: string[];
}

export async function fetchKaomojiCollectionEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const owner = "kaomojiya-collection";
  const repo = "kaomoji-collection";
  const probe = await probeGitHubRepo(owner, repo, fetchFn);
  if (!probe.exists) return { entries: [], pages_discovered: 0, pages_processed: 0, files_processed: 0, errors: ["repo 404"] };
  const branch = probe.default_branch ?? "main";
  const main = await fetchGitHubRawJson(owner, repo, "kaomoji.json", branch, fetchFn);
  if (main) entries.push(...extractStringsFromJson(main, { source_file: "kaomoji.json", source_page: `https://github.com/${owner}/${repo}` }, { idPrefix: "kc" }));
  const cats = await listGitHubContents(owner, repo, "categories", fetchFn);
  let files = 0;
  for (const f of cats) {
    if (f.type !== "file" || !f.path.endsWith(".json")) continue;
    const payload = await fetchGitHubRawJson(owner, repo, f.path, branch, fetchFn);
    files += 1;
    if (payload) {
      const cat = f.path.replace("categories/", "").replace(".json", "");
      entries.push(...extractStringsFromJson(payload, { source_file: f.path, source_category: cat, source_page: `https://github.com/${owner}/${repo}/blob/${branch}/${f.path}` }, { idPrefix: `kc:${cat}` }));
    }
  }
  return { entries, pages_discovered: 1 + cats.length, pages_processed: 1 + files, files_processed: 1 + files, errors };
}

export async function fetchEmoticonWooormEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const payload = await fetchGitHubRawJson("wooorm", "emoticon", "alias.json", "main", fetchFn);
  const entries = payload ? parseWooormEmoticonAlias(payload, "alias.json") : [];
  return { entries, pages_discovered: 1, pages_processed: payload ? 1 : 0, files_processed: payload ? 1 : 0, errors: payload ? [] : ["alias.json missing"] };
}

export async function fetchGenerateKaomojiEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const payload = await fetchGitHubRawJson("xav-ie", "generate-kaomoji", "kaomoji.json", "main", fetchFn);
  const entries = payload ? parseGenerateKaomojiJson(payload, "kaomoji.json") : [];
  return { entries, pages_discovered: 1, pages_processed: payload ? 1 : 0, files_processed: payload ? 1 : 0, errors: payload ? [] : ["kaomoji.json missing"] };
}

export async function fetchKawaiiFacesEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
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

export async function fetchNodeKaomojiEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const owner = "omnidan";
  const repo = "node-kaomoji";
  const payload = await fetchGitHubRawJson(owner, repo, "lib/kaomoji.json", "master", fetchFn);
  if (!payload || typeof payload !== "object") {
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors: ["lib/kaomoji.json missing"] };
  }
  const entries: ImportEntry[] = [];
  let idx = 0;
  for (const [category, arr] of Object.entries(payload as Record<string, unknown>)) {
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const text = arr[i];
      if (typeof text !== "string" || !text.trim()) continue;
      entries.push({
        original_kaomoji: text.trim(),
        source_record_id: `${category}:${i}`,
        source_category: category,
        source_file: "lib/kaomoji.json",
        content_type: "KAOMOJI",
        occurrence_index: idx++,
      });
    }
  }
  return { entries, pages_discovered: 1, pages_processed: 1, files_processed: 1, errors: [] };
}

export async function fetchRandomKaomojiEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const text = await fetchGitHubRawText("6", "random-kaomoji", "face.yml", "master", fetchFn);
  const entries = text ? parseRandomKaomojiYaml(text, "face.yml") : [];
  return { entries, pages_discovered: 1, pages_processed: text ? 1 : 0, files_processed: text ? 1 : 0, errors: text ? [] : ["face.yml missing"] };
}

export async function fetchKaomojiJsonEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  let files = 0;
  for (const [owner, repo, branch, filePaths] of [
    ["6", "kaomoji-json", "master", ["kao-utf8.json", "kao-shiftjis.json", "kaomoji.json", "data.json"]],
    ["chengxuncc", "kaomoji-json", "main", ["kaomoji.json", "data.json"]],
  ] as const) {
    for (const filePath of filePaths) {
      const payload = await fetchGitHubRawJson(owner, repo, filePath, branch, fetchFn);
      if (!payload) continue;
      files += 1;
      entries.push(
        ...extractStringsFromJson(
          payload,
          { source_file: filePath, source_page: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}` },
          { idPrefix: `kj:${filePath}` },
        ),
      );
    }
    if (entries.length > 0) {
      return { entries, pages_discovered: 1, pages_processed: 1, files_processed: files, errors };
    }
    errors.push(`${owner}/${repo}: no data files found`);
  }
  return { entries: [], pages_discovered: 2, pages_processed: 0, files_processed: 0, errors: errors.length ? errors : ["all repo attempts failed"] };
}

export async function fetchKaomojiCaptionEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const url = "https://huggingface.co/api/datasets/mrzjy/kaomoji_caption/parquet/default/train/0.parquet";
  errors.push("HF parquet requires dedicated parser — using dataset viewer JSON fallback");
  const viewer = await fetchFn("https://datasets-server.huggingface.co/first-rows?dataset=mrzjy/kaomoji_caption&config=default&split=train", {
    headers: { "User-Agent": "EmojiQuick-Phase5/1.0" },
  });
  if (!viewer.ok) {
    errors.push(`HF viewer ${viewer.status}`);
    return { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors };
  }
  const data = (await viewer.json()) as { rows?: Array<{ row?: Record<string, string> }> };
  let idx = 0;
  for (const row of data.rows ?? []) {
    const r = row.row ?? {};
    const k = (r.kaomoji ?? r.text ?? r.emoticon ?? "").trim();
    const caption = (r.caption ?? r.label ?? r.description ?? "").trim();
    if (!k) continue;
    entries.push({
      original_kaomoji: k,
      source_record_id: `hf:${idx}`,
      source_page: "https://huggingface.co/datasets/mrzjy/kaomoji_caption",
      source_file: "default/train",
      source_metadata: caption ? { caption } : null,
      content_type: "KAOMOJI",
      occurrence_index: idx++,
    });
  }
  return { entries, pages_discovered: 1, pages_processed: 1, files_processed: 1, errors };
}

export async function fetchJapaneseEmoticonsOrgEntries(fetchFn: typeof fetch = fetch): Promise<Phase5ImportResult> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const base = "https://japaneseemoticons.org";
  const res = await fetchFn(base, { headers: { "User-Agent": "EmojiQuick-Phase5/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    errors.push(`homepage ${res.status}`);
    return { entries: [], pages_discovered: 0, pages_processed: 0, files_processed: 0, errors };
  }
  const html = await res.text();
  let idx = 0;
  const seen = new Set<string>();
  for (const m of html.matchAll(/<(?:span|td|pre|code)[^>]*>([^<]{2,120})<\/(?:span|td|pre|code)>/g)) {
    const t = m[1]!.trim();
    const key = `${t}`;
    if (seen.has(key) || !/[^\w\s]/.test(t) || t.length > 100) continue;
    seen.add(key);
    entries.push({
      original_kaomoji: t,
      source_record_id: `jeo:home:${idx}`,
      source_page: base,
      source_category: "homepage",
      content_type: "KAOMOJI",
      occurrence_index: idx++,
    });
  }
  const sm = await fetchFn(`${base}/sitemap.xml`, { headers: { "User-Agent": "EmojiQuick-Phase5/1.0" } });
  const urls = sm.ok ? [...(await sm.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]!) : [];
  let processed = 1;
  for (const pageUrl of urls.slice(0, 30)) {
    const page = await fetchFn(pageUrl, { headers: { "User-Agent": "EmojiQuick-Phase5/1.0" }, signal: AbortSignal.timeout(20000) });
    processed += 1;
    if (!page.ok) continue;
    const pageHtml = await page.text();
    const cat = pageUrl.replace(base, "").replace(/^\//, "") || "index";
    for (const m of pageHtml.matchAll(/<(?:span|td|pre|code|li)[^>]*>([^<]{2,120})<\/(?:span|td|pre|code|li)>/g)) {
      const t = m[1]!.trim();
      if (!/[^\w\s]/.test(t) || t.length > 100) continue;
      entries.push({
        original_kaomoji: t,
        source_record_id: `jeo:${cat}:${idx}`,
        source_page: pageUrl,
        source_category: cat,
        content_type: "KAOMOJI",
        occurrence_index: idx++,
      });
    }
  }
  return { entries, pages_discovered: 1 + urls.length, pages_processed: processed, files_processed: 0, errors };
}

/** Phase 5 emoticon-data: one occurrence per tag per emoticon. */
export function expandEmoticonDataOccurrences(entries: ImportEntry[]): ImportEntry[] {
  const expanded: ImportEntry[] = [];
  for (const entry of entries) {
    const tags = entry.source_category?.split(", ").filter(Boolean) ?? [];
    if (tags.length <= 1) {
      expanded.push(entry);
      continue;
    }
    tags.forEach((tag, i) => {
      expanded.push({
        ...entry,
        source_record_id: `${entry.source_record_id ?? "e"}@${tag}`,
        source_category: tag,
        occurrence_index: i,
      });
    });
  }
  return expanded;
}
