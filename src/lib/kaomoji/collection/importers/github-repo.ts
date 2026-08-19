import type { ImportEntry } from "./types";
import { fetchPage } from "./fetch-utils";

const UA = "EmojiQuick-Phase5/1.0 (research; local development)";

export interface GitHubFileEntry {
  readonly path: string;
  readonly type: "file" | "dir";
  readonly download_url: string | null;
}

export async function listGitHubContents(
  owner: string,
  repo: string,
  path: string,
  fetchFn: typeof fetch = fetch,
): Promise<GitHubFileEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetchFn(url, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" } });
  if (!res.ok) return [];
  const payload = (await res.json()) as Array<{ path: string; type: string; download_url: string | null }>;
  if (!Array.isArray(payload)) return [];
  return payload.map((f) => ({ path: f.path, type: f.type as "file" | "dir", download_url: f.download_url }));
}

export async function fetchGitHubRawJson(
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
  fetchFn: typeof fetch = fetch,
): Promise<unknown | null> {
  for (const b of [branch, branch === "main" ? "master" : "main"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/${filePath}`;
    const res = await fetchFn(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      try {
        return (await res.json()) as unknown;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function fetchGitHubRawText(
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  for (const b of [branch, branch === "main" ? "master" : "main"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/${filePath}`;
    const res = await fetchFn(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.text();
  }
  return null;
}

/** Extract string entries from heterogeneous JSON payloads — preserves every occurrence. */
export function extractStringsFromJson(
  payload: unknown,
  ctx: { source_file: string; source_category?: string | null; source_page?: string | null },
  opts: { textKeys?: string[]; idPrefix?: string } = {},
): ImportEntry[] {
  const textKeys = opts.textKeys ?? ["text", "string", "kaomoji", "face", "emoticon", "content", "value"];
  const entries: ImportEntry[] = [];
  let idx = 0;

  function walk(node: unknown, category: string | null, path: string): void {
    if (typeof node === "string") {
      const text = node.trim();
      if (text.length >= 1 && text.length <= 200 && /[^\w\s]/.test(text)) {
        entries.push({
          original_kaomoji: text,
          source_record_id: `${opts.idPrefix ?? "json"}:${path}:${idx++}`,
          source_category: category,
          source_page: ctx.source_page ?? null,
          source_file: ctx.source_file,
          occurrence_index: idx,
        });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, category, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const key of textKeys) {
        if (typeof obj[key] === "string") {
          const text = (obj[key] as string).trim();
          if (text.length >= 1 && text.length <= 200) {
            entries.push({
              original_kaomoji: text,
              source_record_id: `${opts.idPrefix ?? "json"}:${path}:${key}:${idx++}`,
              source_category: category ?? (typeof obj.category === "string" ? obj.category : null),
              source_title: typeof obj.slug === "string" ? obj.slug : null,
              source_page: ctx.source_page ?? null,
              source_file: ctx.source_file,
              source_metadata: typeof obj.caption === "string" ? { caption: obj.caption } : null,
              occurrence_index: idx,
            });
          }
        }
      }
      for (const [k, v] of Object.entries(obj)) {
        if (textKeys.includes(k)) continue;
        walk(v, category ?? k, `${path}.${k}`);
      }
    }
  }

  walk(payload, ctx.source_category ?? null, "root");
  return entries;
}

/** Parse wooorm/emoticon alias.json — each alias is a separate occurrence. */
export function parseWooormEmoticonAlias(payload: unknown, sourceFile: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  if (!payload || typeof payload !== "object") return entries;
  let idx = 0;
  for (const [name, value] of Object.entries(payload as Record<string, unknown>)) {
    const texts = Array.isArray(value) ? value : [value];
    for (const t of texts) {
      if (typeof t !== "string") continue;
      entries.push({
        original_kaomoji: t,
        source_record_id: `alias:${name}:${idx}`,
        source_category: name,
        source_file: sourceFile,
        content_type: "EMOTICON",
        occurrence_index: idx++,
      });
    }
  }
  return entries;
}

/** Parse generate-kaomoji kaomoji.json — { kaomoji: [{ category, value }] }. */
export function parseGenerateKaomojiJson(payload: unknown, sourceFile: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  if (!payload || typeof payload !== "object") return entries;
  const root = payload as Record<string, unknown>;
  const list = Array.isArray(root.kaomoji) ? root.kaomoji : Array.isArray(payload) ? payload : [];
  let idx = 0;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const value = typeof obj.value === "string" ? obj.value.trim() : typeof obj.text === "string" ? obj.text.trim() : "";
    if (!value || value.length > 200) continue;
    entries.push({
      original_kaomoji: value,
      source_record_id: `gk:${typeof obj.category === "string" ? obj.category : "unknown"}:${idx}`,
      source_category: typeof obj.category === "string" ? obj.category : null,
      source_file: sourceFile,
      content_type: "KAOMOJI",
      occurrence_index: idx++,
    });
  }
  return entries;
}

/** Parse kawaii-faces JS export: module.exports = [...] or export default [...] */
export function parseKawaiiFacesJs(text: string, category: string, sourceFile: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const match =
    text.match(/export\s+default\s+(\[[\s\S]*\])\s*;?\s*$/) ??
    text.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) return entries;
  try {
    const arr = JSON.parse(match[1]!.replace(/'/g, '"')) as unknown;
    if (Array.isArray(arr)) {
      arr.forEach((item, i) => {
        if (typeof item === "string" && item.trim()) {
          entries.push({
            original_kaomoji: item.trim(),
            source_record_id: `${category}:${i}`,
            source_category: category,
            source_file: sourceFile,
            content_type: "KAOMOJI",
            occurrence_index: i,
          });
        }
      });
    }
  } catch {
    for (const m of text.matchAll(/['"]([^'"]{2,80})['"]/g)) {
      const t = m[1]!.trim();
      if (/[^\w\s]/.test(t)) {
        entries.push({
          original_kaomoji: t,
          source_record_id: `${category}:${entries.length}`,
          source_category: category,
          source_file: sourceFile,
          content_type: "KAOMOJI",
          occurrence_index: entries.length,
        });
      }
    }
  }
  return entries;
}

/** Parse YAML face list from random-kaomoji/face.yml */
export function parseRandomKaomojiYaml(text: string, sourceFile: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  let idx = 0;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s+(.+)$/);
    if (!m) continue;
    const t = m[1]!.trim().replace(/^['"]|['"]$/g, "");
    if (t.length >= 2) {
      entries.push({
        original_kaomoji: t,
        source_record_id: `face:${idx}`,
        source_file: sourceFile,
        content_type: "KAOMOJI",
        occurrence_index: idx++,
      });
    }
  }
  return entries;
}

export async function probeGitHubRepo(
  owner: string,
  repo: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ exists: boolean; default_branch: string | null; license: string | null }> {
  const res = await fetchFn(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { "User-Agent": UA, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return { exists: false, default_branch: null, license: null };
  const data = (await res.json()) as { default_branch?: string; license?: { spdx_id?: string } };
  return {
    exists: true,
    default_branch: data.default_branch ?? "main",
    license: data.license?.spdx_id ?? null,
  };
}

export async function fetchPageText(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const r = await fetchPage(url, fetchFn);
  return r.html;
}
