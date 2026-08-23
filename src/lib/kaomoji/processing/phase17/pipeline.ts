import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashRawFile } from "../phase7/raw-snapshot";
import { KAOMOJI_FILTER_CATEGORIES } from "../../ui/filters";
import type { Phase17Manifest } from "./types";
import { PHASE17_UI_VERSION } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase17ManifestPath,
  getPhase17RootDir,
  PHASE17_PIPELINE_VERSION,
} from "../../storage/paths";

const DEBOUNCE_MS = 300;

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase17PipelineResult {
  readonly manifest: Phase17Manifest;
}

export function runPhase17Pipeline(rootDir: string): Phase17PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const out = getPhase17RootDir(rootDir);
  const accessibility = [
    "aria-label on search input",
    "aria-live for results",
    "min touch target 44px",
    "keyboard copy on card",
    "sr-only headings",
    "focus visible buttons",
  ];
  writeJson(join(out, "ui-checklist.json"), {
    instant_search: true,
    debounce_ms: DEBOUNCE_MS,
    filters: KAOMOJI_FILTER_CATEGORIES,
    accessibility,
    mobile_first: true,
    quality_scores_hidden: true,
  });
  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 17");
  const manifest: Phase17Manifest = {
    phase: 17,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE17_PIPELINE_VERSION,
    ui_version: PHASE17_UI_VERSION,
    instant_search: true,
    debounce_ms: DEBOUNCE_MS,
    filter_categories: KAOMOJI_FILTER_CATEGORIES.length,
    accessibility_checks: accessibility,
    mobile_first: true,
    errors,
    warnings,
  };
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase17ManifestPath(rootDir), manifest);
  return { manifest };
}
