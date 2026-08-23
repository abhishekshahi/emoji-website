import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashRawFile } from "../phase7/raw-snapshot";
import type { Phase21Manifest } from "./types";
import { PHASE21_QA_VERSION, PRODUCTION_DATA_COUNTS } from "./types";
import { KAOMOJI_LOCALES } from "./audits";
import {
  auditAnalytics,
  auditPhase19Gate,
  auditPhase20Gate,
  auditRollbackManifest,
  auditRouteFiles,
} from "./audits";
import { runPhase20Pipeline } from "../phase20/pipeline";
import {
  getKaomojiRawRecordsPath,
  getPhase20ManifestPath,
  getPhase21ManifestPath,
  getPhase21RootDir,
  PHASE21_PIPELINE_VERSION,
} from "../../storage/paths";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase21PipelineOptions {
  readonly remote?: boolean;
  readonly typecheckPassed?: boolean;
  readonly buildPassed?: boolean;
}

export interface Phase21PipelineResult {
  readonly manifest: Phase21Manifest;
}

export function runPhase21Pipeline(rootDir: string, options: Phase21PipelineOptions = {}): Phase21PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const remote = options.remote ?? false;

  if (!existsSync(getPhase20ManifestPath(rootDir))) runPhase20Pipeline(rootDir);
  else {
    const phase20 = auditPhase20Gate(rootDir);
    if (!phase20) runPhase20Pipeline(rootDir);
  }

  const rawShaBefore = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const routes = auditRouteFiles(rootDir);
  const analytics = auditAnalytics(rootDir);
  const phase19 = auditPhase19Gate(rootDir, remote);
  const phase20 = auditPhase20Gate(rootDir);
  const rollback = auditRollbackManifest(rootDir);

  if (!phase19) errors.push(remote ? "D1 import incomplete" : "Phase 19 manifest gate failed");
  if (!phase20) errors.push("Phase 20 hardening gate failed");
  if (analytics.popularity !== "INSUFFICIENT_DATA") warnings.push("Popularity should remain INSUFFICIENT_DATA pre-launch");
  if (routes.length < 3) errors.push("Missing public kaomoji routes");

  const rawShaAfter = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 21");

  const manifest: Phase21Manifest = {
    phase: 21,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE21_PIPELINE_VERSION,
    qa_version: PHASE21_QA_VERSION,
    data_counts: PRODUCTION_DATA_COUNTS,
    routes_audited: routes,
    locales: [...KAOMOJI_LOCALES],
    seo: {
      sitemap_expected_urls: PRODUCTION_DATA_COUNTS.public,
      hreflang_locales: KAOMOJI_LOCALES.length,
      json_ld_routes: routes.includes("/kaomoji"),
    },
    analytics: {
      popularity_status: analytics.popularity,
      events_wired: analytics.events,
    },
    rollback: {
      previous_release_exists: rollback,
      rollback_manifest_exists: rollback,
    },
    gates: {
      phase19,
      phase20,
      typecheck: options.typecheckPassed ?? false,
      build: options.buildPassed ?? false,
    },
    errors,
    warnings,
  };

  const out = getPhase21RootDir(rootDir);
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase21ManifestPath(rootDir), manifest);
  return { manifest };
}
