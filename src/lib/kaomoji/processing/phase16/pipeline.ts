import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { KaomojiEditorialRecord } from "../phase9/types";
import { hashRawFile } from "../phase7/raw-snapshot";
import { countIndexableKaomoji, isKaomojiIndexable } from "../../seo/indexability";
import type { Phase16Manifest } from "./types";
import { PHASE16_SEO_VERSION } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase12PublicQualityDir,
  getPhase16ManifestPath,
  getPhase16RootDir,
  PHASE16_PIPELINE_VERSION,
} from "../../storage/paths";

const COLLECTION_SLUGS = ["cute", "happy", "love", "cat", "japanese", "ascii", "kawaii"] as const;

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase16PipelineResult {
  readonly manifest: Phase16Manifest;
}

export function runPhase16Pipeline(rootDir: string): Phase16PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const libDir = getPhase12PublicQualityDir(rootDir);
  const editorial = JSON.parse(readFileSync(join(libDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const publicRecords = editorial.filter((r) => r.is_public);
  const indexable = publicRecords.filter(isKaomojiIndexable);
  const collectionCounts = COLLECTION_SLUGS.map((slug) => ({
    slug,
    count: publicRecords.filter((r) => r.emojiquick_categories.some((c) => c.slug === slug)).length,
  })).filter((c) => c.count >= 10);
  const out = getPhase16RootDir(rootDir);
  writeJson(join(out, "indexable-slugs.json"), indexable.map((r) => r.slug));
  writeJson(join(out, "collection-pages.json"), collectionCounts);
  writeJson(join(out, "structured-data-catalog.json"), {
    types: ["WebPage", "BreadcrumbList", "CollectionPage", "ItemList"],
    hreflang: true,
  });
  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 16");
  if (indexable.length !== publicRecords.length) {
    warnings.push(`indexable ${indexable.length} vs public ${publicRecords.length}`);
  }
  const manifest: Phase16Manifest = {
    phase: 16,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE16_PIPELINE_VERSION,
    seo_version: PHASE16_SEO_VERSION,
    total_public: publicRecords.length,
    indexable_count: indexable.length,
    indexable_rate: publicRecords.length ? indexable.length / publicRecords.length : 0,
    sitemap_slugs: indexable.length,
    collection_pages: collectionCounts.length,
    structured_data_types: ["WebPage", "BreadcrumbList", "CollectionPage", "ItemList"],
    errors,
    warnings,
  };
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase16ManifestPath(rootDir), manifest);
  return { manifest };
}
