import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashRawFile } from "../phase7/raw-snapshot";
import { buildPhase15LocaleRegistry } from "../../localization/registry";
import { kaomojiListingHreflangAlternates } from "../../localization/paths";
import { LOCALIZED_SEARCH_TERMS } from "../../localization/search-terms";
import type { Phase15Manifest } from "./types";
import { PHASE15_LOCALE_VERSION } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase15LocaleRegistryPath,
  getPhase15ManifestPath,
  getPhase15RootDir,
  PHASE15_PIPELINE_VERSION,
} from "../../storage/paths";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase15PipelineResult {
  readonly manifest: Phase15Manifest;
}

export function runPhase15Pipeline(rootDir: string): Phase15PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const registry = buildPhase15LocaleRegistry();
  const out = getPhase15RootDir(rootDir);
  writeJson(getPhase15LocaleRegistryPath(rootDir), registry);
  writeJson(join(out, "localized-search-terms.json"), LOCALIZED_SEARCH_TERMS);
  const hreflang = kaomojiListingHreflangAlternates();
  writeJson(join(out, "hreflang-routes.json"), hreflang);
  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 15");
  const published = registry.bundles.filter((b) => b.status === "PUBLISHED").length;
  const review = registry.bundles.filter((b) => b.status === "REVIEW_REQUIRED").length;
  if (LOCALIZED_SEARCH_TERMS.length < 30) warnings.push("localized search term count below 30");
  const manifest: Phase15Manifest = {
    phase: 15,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE15_PIPELINE_VERSION,
    locale_version: PHASE15_LOCALE_VERSION,
    supported_locales: registry.supportedLocales.length,
    localized_search_terms: LOCALIZED_SEARCH_TERMS.length,
    published_locales: published,
    review_required_locales: review,
    hreflang_routes: hreflang.length,
    errors,
    warnings,
  };
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase15ManifestPath(rootDir), manifest);
  return { manifest };
}
