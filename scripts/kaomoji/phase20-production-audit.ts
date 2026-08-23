#!/usr/bin/env npx tsx
/**
 * Phase 20 production verification — read-only checks against live Worker.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhase20RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const BASE = process.env.PHASE19_WORKER_URL ?? "https://emoji-website.emoji-website.workers.dev";

interface FetchMetric {
  path: string;
  status: number;
  ms: number;
  bytes: number;
  cache_control: string | null;
}

async function fetchMetric(path: string, init?: RequestInit): Promise<FetchMetric> {
  const url = `${BASE}${path}`;
  const start = performance.now();
  const res = await fetch(url, { ...init, redirect: "follow", signal: AbortSignal.timeout(45000) });
  const buf = await res.arrayBuffer();
  return {
    path,
    status: res.status,
    ms: Math.round(performance.now() - start),
    bytes: buf.byteLength,
    cache_control: res.headers.get("cache-control"),
  };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();

  const perfBefore = JSON.parse(
    readFileSync(join(getPhase20RootDir(rootDir), "..", "phase-19", "phase19-final-hardening-audit.json"), "utf8"),
  ) as { performance?: { cold?: FetchMetric[] } };

  const collectionLegacy = await fetchMetric("/kaomoji/collections/best-kaomoji");
  const collectionPaged = await fetchMetric("/kaomoji/collections/best-kaomoji/page/1");
  const search = await fetchMetric("/api/kaomoji/search?q=anime&limit=10");
  const searchRepeat = await fetchMetric("/api/kaomoji/search?q=anime&limit=10");
  const rateProbe = await fetchMetric("/api/kaomoji/search?q=phase20-rate-probe&limit=5");

  const securityProbes = [
    await fetchMetric("/api/kaomoji/search?q=' OR 1=1--"),
    await fetchMetric("/api/kaomoji/search?q=<script>alert(1)</script>"),
    await fetchMetric("/kaomoji/../../../etc/passwd"),
    await fetchMetric("/api/kaomoji/search", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }),
  ];

  const oldCollectionBytes =
    perfBefore.performance?.cold?.find((r: FetchMetric) => r.path.includes("collections/best-kaomoji"))?.bytes ?? null;

  const collectionOptimized =
    collectionPaged.status >= 200 && collectionPaged.status < 400 ? collectionPaged.bytes : null;

  const report = {
    timestamp,
    worker_base: BASE,
    performance: {
      collection_legacy_redirect: collectionLegacy,
      collection_page_1: collectionPaged,
      search_cold: search,
      search_warm: searchRepeat,
      collection_bytes_before: oldCollectionBytes,
      collection_bytes_after: collectionOptimized,
      collection_reduction_pct:
        oldCollectionBytes && collectionOptimized && oldCollectionBytes > 0
          ? Math.round((1 - collectionOptimized / oldCollectionBytes) * 100)
          : null,
      collection_pagination_live: collectionOptimized !== null ? "DEPLOYED" : "NOT VERIFIED — page/1 not live until deploy",
    },
    security: {
      probes: securityProbes.map((p) => ({
        path: p.path,
        status: p.status,
        pass: p.status !== 500 && p.status < 600,
      })),
      post_status: securityProbes[3]?.status,
      post_pass: securityProbes[3]?.status === 405,
    },
    cache: {
      search_repeat_ms_delta: searchRepeat.ms - search.ms,
      collection_cache: collectionPaged.cache_control,
    },
    rate_limit: {
      note: "429 requires burst; single probe only",
      probe: rateProbe,
    },
  };

  const outDir = getPhase20RootDir(rootDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "phase20-production-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
