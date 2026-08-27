import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiCollection, KaomojiEditorialRecord, Phase9Manifest } from "../processing/phase9/types";
import type { SearchIndex } from "../processing/phase9/search-index";
import type { SearchIndexV2 } from "../processing/phase14/types";
import { buildSearchIndexV2 } from "../processing/phase14/search-index-v2";
import type { KaomojiRelationship } from "../processing/phase9/types";
import { resolveEditorialRelatedBundle } from "../related/resolve-editorial";
import type { RelatedKaomojiBundle } from "../related/types";
import type { Phase12Manifest } from "../processing/phase12/types";
import {
  getPhase9EditorialDir,
  getPhase9ManifestPath,
  getPhase9RootDir,
  getPhase12ManifestPath,
  getPhase12PublicQualityDir,
  getPhase14SearchIndexPath,
} from "../storage/paths";

let editorialCache: KaomojiEditorialRecord[] | null = null;
let searchIndexCache: SearchIndex | null = null;
let searchIndexV2Cache: SearchIndexV2 | null = null;
let relationshipsCache: KaomojiRelationship[] | null = null;
let relatedByFromCache: Map<string, readonly KaomojiRelationship[]> | null = null;
let collectionsCache: KaomojiCollection[] | null = null;
let slugMapCache: Record<string, string> | null = null;
let manifestCache: Phase9Manifest | null = null;
let phase12ManifestCache: Phase12Manifest | null = null;

function rootDir(): string {
  return process.cwd();
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadJsonIfExists<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return loadJson<T>(path);
}

function publicLibDir(): string {
  return getPhase12PublicQualityDir(rootDir());
}

export function phase12DataExists(): boolean {
  return existsSync(getPhase12ManifestPath(rootDir()));
}

export function phase9DataExists(): boolean {
  return existsSync(getPhase9ManifestPath(rootDir()));
}

export function kaomojiDataExists(): boolean {
  return phase12DataExists() || phase9DataExists();
}

export function getPhase12Manifest(): Phase12Manifest {
  if (!phase12ManifestCache) {
    phase12ManifestCache = loadJson(getPhase12ManifestPath(rootDir()));
  }
  return phase12ManifestCache!;
}

export function getPhase9Manifest(): Phase9Manifest {
  if (!manifestCache) {
    manifestCache = loadJson(getPhase9ManifestPath(rootDir()));
  }
  return manifestCache!;
}

function editorialPath(): string {
  if (phase12DataExists()) return join(publicLibDir(), "editorial.json");
  return join(getPhase9EditorialDir(rootDir()), "editorial-records.json");
}

export function loadEditorialRecords(): readonly KaomojiEditorialRecord[] {
  if (!editorialCache) {
    if (!kaomojiDataExists()) throw new Error("Run npm run kaomoji:phase12 first");
    editorialCache = loadJson(editorialPath());
  }
  return editorialCache!;
}

export function loadSearchIndex(): SearchIndex {
  if (!searchIndexCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "search-index.json")
      : join(getPhase9EditorialDir(rootDir()), "search-index.json");
    searchIndexCache = loadJson(p);
  }
  return searchIndexCache!;
}

export function phase14DataExists(): boolean {
  return existsSync(getPhase14SearchIndexPath(rootDir()));
}

export function loadSearchIndexV2(): SearchIndexV2 {
  if (!searchIndexV2Cache) {
    if (phase14DataExists()) {
      searchIndexV2Cache = loadJson(getPhase14SearchIndexPath(rootDir()));
    } else {
      searchIndexV2Cache = buildSearchIndexV2([...loadEditorialRecords()]);
    }
  }
  return searchIndexV2Cache!;
}

export function loadRelationships(): readonly KaomojiRelationship[] {
  if (!relationshipsCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "relationships.json")
      : join(getPhase9EditorialDir(rootDir()), "relationships.json");
    relationshipsCache = loadJson(p);
  }
  return relationshipsCache!;
}

function relatedByFromIndex(): Map<string, readonly KaomojiRelationship[]> {
  if (!relatedByFromCache) {
    const index = new Map<string, KaomojiRelationship[]>();
    for (const rel of loadRelationships()) {
      const list = index.get(rel.from_canonical_id) ?? [];
      list.push(rel);
      index.set(rel.from_canonical_id, list);
    }
    relatedByFromCache = new Map(
      [...index.entries()].map(([id, list]) => [
        id,
        [...list].sort(
          (a, b) => b.score - a.score || a.to_canonical_id.localeCompare(b.to_canonical_id),
        ),
      ]),
    );
  }
  return relatedByFromCache;
}

/** Public editorial records related to a canonical id (build-time / SSG safe). */
export function getRelatedEditorialRecords(canonicalId: string, limit = 8): readonly KaomojiEditorialRecord[] {
  const bundle = getRelatedEditorialBundle(canonicalId, limit);
  const records = loadEditorialRecords();
  const byId = new Map(records.map((r) => [r.canonical_id, r]));
  const out: KaomojiEditorialRecord[] = [];
  for (const hit of [...bundle.similar, ...bundle.related]) {
    const record = byId.get(hit.canonical_id);
    if (record?.is_public) out.push(record);
    if (out.length >= limit) break;
  }
  return out;
}

export function getRelatedEditorialBundle(
  canonicalId: string,
  limit = 12,
): RelatedKaomojiBundle {
  const records = loadEditorialRecords();
  const source = records.find((r) => r.canonical_id === canonicalId);
  if (!source) return { similar: [], related: [] };
  const similarLimit = Math.min(8, limit);
  const relatedLimit = Math.max(0, limit - similarLimit);
  return resolveEditorialRelatedBundle(source, loadRelationships(), new Map(records.map((r) => [r.canonical_id, r])), {
    similarLimit,
    relatedLimit,
  });
}

export function loadCollections(): readonly KaomojiCollection[] {
  if (!collectionsCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "collections.json")
      : join(getPhase9EditorialDir(rootDir()), "collections.json");
    collectionsCache = loadJsonIfExists<KaomojiCollection[]>(p) ?? [];
  }
  return collectionsCache!;
}

export function loadSlugMap(): Record<string, string> {
  if (!slugMapCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "slug-map.json")
      : join(getPhase9EditorialDir(rootDir()), "slug-map.json");
    slugMapCache = loadJsonIfExists<Record<string, string>>(p) ?? {};
  }
  return slugMapCache!;
}

export function getEditorialBySlug(slug: string): KaomojiEditorialRecord | null {
  if (!kaomojiDataExists()) return null;
  const map = loadSlugMap();
  const id = map[slug];
  if (!id) return null;
  return loadEditorialRecords().find((r) => r.canonical_id === id) ?? null;
}

export function getPublicEditorialRecords(limit?: number): readonly KaomojiEditorialRecord[] {
  const records = loadEditorialRecords();
  const pub = phase12DataExists() ? records : records.filter((r) => r.is_public);
  return limit ? pub.slice(0, limit) : pub;
}

export function getIndexableSlugs(limit = 500): string[] {
  return getPublicEditorialRecords()
    .filter((r) => r.editorial_priority === "P0" || r.editorial_priority === "P1")
    .slice(0, limit)
    .map((r) => r.slug);
}

export function getAllPublicSlugs(): string[] {
  return getPublicEditorialRecords().map((r) => r.slug);
}
