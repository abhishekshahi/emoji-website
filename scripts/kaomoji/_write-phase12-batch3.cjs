const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

// paths.ts addition via node
const pathsFile = path.join(root, "src/lib/kaomoji/storage/paths.ts");
let paths = fs.readFileSync(pathsFile, "utf8");
if (!paths.includes("getPhase12PublicLibraryDir")) {
  paths = paths.replace(
    `export const PHASE11_PIPELINE_VERSION = "11.0.0-composition-audit-analysis-only";

export function getImportFilePath`,
    `export const PHASE11_PIPELINE_VERSION = "11.0.0-composition-audit-analysis-only";

export function getPhase12RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-12");
}

export function getPhase12PublicLibraryDir(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "public-library");
}

export function getPhase12ManifestPath(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "manifests", "phase-12-final.json");
}

export const PHASE12_PIPELINE_VERSION = "12.0.0-public-library-quality-filter";

export function getImportFilePath`,
  );
  fs.writeFileSync(pathsFile, paths, "utf8");
  console.log("updated paths.ts");
}

// loader.ts - rewrite to support phase 12
const loader = `import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiCollection, KaomojiEditorialRecord, Phase9Manifest } from "../processing/phase9/types";
import type { SearchIndex } from "../processing/phase9/search-index";
import type { KaomojiRelationship } from "../processing/phase9/types";
import type { Phase12Manifest } from "../processing/phase12/types";
import {
  getPhase9EditorialDir,
  getPhase9ManifestPath,
  getPhase9RootDir,
  getPhase12ManifestPath,
  getPhase12PublicLibraryDir,
} from "../storage/paths";

let editorialCache: KaomojiEditorialRecord[] | null = null;
let searchIndexCache: SearchIndex | null = null;
let relationshipsCache: KaomojiRelationship[] | null = null;
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

function publicLibDir(): string {
  return getPhase12PublicLibraryDir(rootDir());
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

export function loadRelationships(): readonly KaomojiRelationship[] {
  if (!relationshipsCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "relationships.json")
      : join(getPhase9EditorialDir(rootDir()), "relationships.json");
    relationshipsCache = loadJson(p);
  }
  return relationshipsCache!;
}

export function loadCollections(): readonly KaomojiCollection[] {
  if (!collectionsCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "collections.json")
      : join(getPhase9EditorialDir(rootDir()), "collections.json");
    collectionsCache = loadJson(p);
  }
  return collectionsCache!;
}

export function loadSlugMap(): Record<string, string> {
  if (!slugMapCache) {
    const p = phase12DataExists()
      ? join(publicLibDir(), "slug-map.json")
      : join(getPhase9EditorialDir(rootDir()), "slug-map.json");
    slugMapCache = loadJson(p);
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
`;

fs.writeFileSync(path.join(root, "src/lib/kaomoji/product/loader.ts"), loader, "utf8");
console.log("wrote loader.ts");

// run-phase12.ts
fs.writeFileSync(path.join(root, "scripts/kaomoji/run-phase12.ts"), [
  'import { join } from "node:path";',
  'import { fileURLToPath } from "node:url";',
  'import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";',
  '',
  'const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");',
  '',
  'function main(): void {',
  '  console.log("Phase 12 — final high-quality public library");',
  '  const { manifest } = runPhase12Pipeline(rootDir);',
  '  console.log("\\n=== Phase 12 Complete ===");',
  '  console.log("Quality qualified:", manifest.quality_qualified);',
  '  console.log("Publication eligible:", manifest.publication_eligible);',
  '  console.log("RAW unchanged:", manifest.raw_before, "->", manifest.raw_after);',
  '}',
  'main();',
  '',
].join("\n"), "utf8");

console.log("batch3 scripts done");
