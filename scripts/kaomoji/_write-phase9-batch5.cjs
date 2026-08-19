const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

w("src/lib/kaomoji/product/loader.ts", `import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiCollection, KaomojiEditorialRecord, Phase9Manifest } from "../processing/phase9/types";
import type { SearchIndex } from "../processing/phase9/search-index";
import type { KaomojiRelationship } from "../processing/phase9/types";
import {
  getPhase9EditorialDir,
  getPhase9ManifestPath,
  getPhase9RootDir,
} from "../storage/paths";

let editorialCache: KaomojiEditorialRecord[] | null = null;
let searchIndexCache: SearchIndex | null = null;
let relationshipsCache: KaomojiRelationship[] | null = null;
let collectionsCache: KaomojiCollection[] | null = null;
let slugMapCache: Record<string, string> | null = null;
let manifestCache: Phase9Manifest | null = null;

function rootDir(): string {
  return process.cwd();
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function getPhase9Manifest(): Phase9Manifest {
  if (!manifestCache) {
    manifestCache = loadJson(getPhase9ManifestPath(rootDir()));
  }
  return manifestCache;
}

export function loadEditorialRecords(): readonly KaomojiEditorialRecord[] {
  if (!editorialCache) {
    const p = join(getPhase9EditorialDir(rootDir()), "editorial-records.json");
    if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase9 first");
    editorialCache = loadJson(p);
  }
  return editorialCache!;
}

export function loadSearchIndex(): SearchIndex {
  if (!searchIndexCache) {
    searchIndexCache = loadJson(join(getPhase9EditorialDir(rootDir()), "search-index.json"));
  }
  return searchIndexCache!;
}

export function loadRelationships(): readonly KaomojiRelationship[] {
  if (!relationshipsCache) {
    relationshipsCache = loadJson(join(getPhase9EditorialDir(rootDir()), "relationships.json"));
  }
  return relationshipsCache!;
}

export function loadCollections(): readonly KaomojiCollection[] {
  if (!collectionsCache) {
    collectionsCache = loadJson(join(getPhase9EditorialDir(rootDir()), "collections.json"));
  }
  return collectionsCache!;
}

export function loadSlugMap(): Record<string, string> {
  if (!slugMapCache) {
    slugMapCache = loadJson(join(getPhase9EditorialDir(rootDir()), "slug-map.json"));
  }
  return slugMapCache!;
}

export function getEditorialBySlug(slug: string): KaomojiEditorialRecord | null {
  const map = loadSlugMap();
  const id = map[slug];
  if (!id) return null;
  return loadEditorialRecords().find((r) => r.canonical_id === id) ?? null;
}

export function getPublicEditorialRecords(limit?: number): readonly KaomojiEditorialRecord[] {
  const pub = loadEditorialRecords().filter((r) => r.is_public);
  return limit ? pub.slice(0, limit) : pub;
}

export function getIndexableSlugs(limit = 500): string[] {
  return getPublicEditorialRecords()
    .filter((r) => r.editorial_priority === "P0" || r.editorial_priority === "P1")
    .slice(0, limit)
    .map((r) => r.slug);
}

export function phase9DataExists(): boolean {
  return existsSync(getPhase9ManifestPath(rootDir()));
}
`);

w("src/lib/kaomoji/product/search.ts", `import "server-only";
import { searchKaomoji, type SearchHit } from "../processing/phase9/search-index";
import { loadSearchIndex } from "./loader";

export function searchKaomojiPublic(query: string, limit = 24): SearchHit[] {
  return searchKaomoji(loadSearchIndex(), query, limit);
}
`);

w("scripts/kaomoji/run-phase9.ts", `import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase9Pipeline } from "@/lib/kaomoji/processing/phase9/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 9 — kaomoji knowledge + product layer");
  const { manifest, searchPassRate } = runPhase9Pipeline(rootDir);
  console.log("\\n=== Phase 9 Complete ===");
  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);
  console.log("Canonical:", manifest.canonical_candidates, "Public:", manifest.public_candidates);
  console.log("Tier 1/2/3:", manifest.tier_1, manifest.tier_2, manifest.tier_3);
  console.log("Collections:", manifest.collections, "Relationships:", manifest.relationships);
  console.log("Search pass rate:", (searchPassRate * 100).toFixed(1) + "%");
}

main();
`);

console.log("batch5 done");
