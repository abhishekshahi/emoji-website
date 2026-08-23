import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhase19RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const WORKER_BASE = process.env.PHASE19_WORKER_URL ?? "https://emoji-website.emoji-website.workers.dev";
const SAMPLE_SLUG = process.env.PHASE19_SAMPLE_SLUG ?? "kao-00013e7cc777f411";
const SAMPLE_COLLECTION = process.env.PHASE19_SAMPLE_COLLECTION ?? "best-kaomoji";

interface SmokeResult {
  readonly path: string;
  readonly status: number | null;
  readonly ok: boolean;
  readonly detail?: string;
}

async function fetchStatus(path: string, expectOk = true, requireRelated = false): Promise<SmokeResult> {
  try {
    const res = await fetch(`${WORKER_BASE}${path}`, { redirect: "follow" });
    const okStatus = expectOk ? res.status >= 200 && res.status < 400 : res.status >= 400 && res.status < 500;
    if (!okStatus) return { path, status: res.status, ok: false };
    if (requireRelated) {
      const html = await res.text();
      const ok = html.includes("related-kaomoji-heading") || html.includes("Related Kaomoji");
      return { path, status: res.status, ok, detail: ok ? undefined : "missing Related Kaomoji section" };
    }
    return { path, status: res.status, ok: true };
  } catch (e) {
    return { path, status: null, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  const tests: SmokeResult[] = [];
  tests.push(await fetchStatus("/"));
  tests.push(await fetchStatus("/kaomoji"));
  tests.push(await fetchStatus(`/kaomoji/${SAMPLE_SLUG}`, true, true));
  tests.push(await fetchStatus(`/kaomoji/collections/${SAMPLE_COLLECTION}/page/1`));
  tests.push(await fetchStatus("/api/kaomoji/search?q=anime&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?q=&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?q=%E7%8C%AB&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?q=%F0%9F%98%80&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?limit=2&offset=0"));
  tests.push(await fetchStatus("/api/kaomoji/search?q=invalid-id-test-xyz&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?q=%00%00&limit=5"));
  tests.push(await fetchStatus("/api/kaomoji/search?limit=99999"));
  tests.push(await fetchStatus(`/kaomoji/invalid-slug-does-not-exist-xyz`, false));

  const report = {
    timestamp: new Date().toISOString(),
    worker_base: WORKER_BASE,
    sample_slug: SAMPLE_SLUG,
    sample_collection: SAMPLE_COLLECTION,
    results: tests,
    pass: tests.filter((t) => t.ok).length,
    total: tests.length,
    valid: tests.every((t) => t.ok),
  };

  mkdirSync(getPhase19RootDir(rootDir), { recursive: true });
  writeFileSync(join(getPhase19RootDir(rootDir), "worker-smoke-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

void main();
