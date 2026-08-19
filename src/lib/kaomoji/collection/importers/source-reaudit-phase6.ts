import type { ImportEntry } from "./types";
import { listGitHubContents, fetchGitHubRawJson, probeGitHubRepo } from "./github-repo";
import { extractStringsFromJson } from "./github-repo";

export interface ReauditResult {
  readonly source_id: string;
  readonly missed_files: readonly string[];
  readonly entries: ImportEntry[];
  readonly errors: readonly string[];
}

/** Re-audit GitHub sources for missed category/json files. */
export async function reauditKaomojiCollection(fetchFn: typeof fetch = fetch): Promise<ReauditResult> {
  const owner = "kaomojiya-collection";
  const repo = "kaomoji-collection";
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const probe = await probeGitHubRepo(owner, repo, fetchFn);
  if (!probe.exists) return { source_id: "kaomoji-collection", missed_files: [], entries: [], errors: ["repo 404"] };
  const branch = probe.default_branch ?? "main";
  const cats = await listGitHubContents(owner, repo, "categories", fetchFn);
  const missed: string[] = [];
  for (const f of cats) {
    if (f.type !== "file" || !f.path.endsWith(".json")) continue;
    const payload = await fetchGitHubRawJson(owner, repo, f.path, branch, fetchFn);
    if (!payload) {
      missed.push(f.path);
      continue;
    }
    const cat = f.path.replace("categories/", "").replace(".json", "");
    entries.push(
      ...extractStringsFromJson(
        payload,
        { source_file: f.path, source_category: cat, source_page: `https://github.com/${owner}/${repo}/blob/${branch}/${f.path}` },
        { idPrefix: `kc:${cat}` },
      ),
    );
  }
  const root = await fetchGitHubRawJson(owner, repo, "kaomoji.json", branch, fetchFn);
  if (root) {
    entries.push(...extractStringsFromJson(root, { source_file: "kaomoji.json" }, { idPrefix: "kc" }));
  }
  return { source_id: "kaomoji-collection", missed_files: missed, entries, errors };
}

export async function reauditEmoticonData(fetchFn: typeof fetch = fetch): Promise<ReauditResult> {
  const owner = "w33ble";
  const repo = "emoticon-data";
  const entries: ImportEntry[] = [];
  const probe = await probeGitHubRepo(owner, repo, fetchFn);
  if (!probe.exists) return { source_id: "emoticon-data", missed_files: [], entries: [], errors: ["repo 404"] };
  const branch = probe.default_branch ?? "master";
  const files = await listGitHubContents(owner, repo, "", fetchFn);
  for (const f of files) {
    if (f.type !== "file" || !f.path.endsWith(".json")) continue;
    const payload = await fetchGitHubRawJson(owner, repo, f.path, branch, fetchFn);
    if (payload) {
      entries.push(...extractStringsFromJson(payload, { source_file: f.path }, { idPrefix: `ed:${f.path}` }));
    }
  }
  return { source_id: "emoticon-data", missed_files: [], entries, errors: [] };
}

export async function reauditKaomojiTagged(fetchFn: typeof fetch = fetch): Promise<ReauditResult> {
  const owner = "kaomojikan";
  const repo = "kaomoji-data";
  const entries: ImportEntry[] = [];
  const probe = await probeGitHubRepo(owner, repo, fetchFn);
  if (!probe.exists) return { source_id: "kaomoji-tagged", missed_files: [], entries: [], errors: ["repo 404"] };
  const branch = probe.default_branch ?? "main";
  const files = await listGitHubContents(owner, repo, "", fetchFn);
  for (const f of files) {
    if (f.type !== "file" || !f.path.endsWith(".json")) continue;
    const payload = await fetchGitHubRawJson(owner, repo, f.path, branch, fetchFn);
    if (payload) {
      entries.push(...extractStringsFromJson(payload, { source_file: f.path }, { idPrefix: `kt:${f.path}` }));
    }
  }
  return { source_id: "kaomoji-tagged", missed_files: [], entries, errors: [] };
}
