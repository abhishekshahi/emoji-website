import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { hashRawFile } from "../phase7/raw-snapshot";
import type { Phase18Manifest } from "./types";
import { PHASE18_ANALYTICS_VERSION } from "./types";
import {
  getKaomojiRawRecordsPath,
  getPhase18ManifestPath,
  getPhase18RootDir,
  PHASE18_PIPELINE_VERSION,
} from "../../storage/paths";

const WIRED_EVENTS = [
  "kaomoji_search",
  "kaomoji_view",
  "kaomoji_copy",
  "kaomoji_favorite",
  "kaomoji_share",
] as const;

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase18PipelineResult {
  readonly manifest: Phase18Manifest;
}

export function runPhase18Pipeline(rootDir: string): Phase18PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = hashRawFile(rawPath).sha256;
  const out = getPhase18RootDir(rootDir);
  writeJson(join(out, "analytics-config.json"), {
    events: WIRED_EVENTS,
    liveEventsEnabled: ANALYTICS_MATURITY.liveEventsEnabled,
    minimumEventsForTrending: ANALYTICS_MATURITY.minimumEventsForTrending,
    popularityLabel: ANALYTICS_MATURITY.rankingLabel,
    antiAbuse: { rateLimit: true, piiBlocked: true, noFabrication: true },
  });
  const rawShaAfter = hashRawFile(rawPath).sha256;
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during Phase 18");
  const manifest: Phase18Manifest = {
    phase: 18,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE18_PIPELINE_VERSION,
    analytics_version: PHASE18_ANALYTICS_VERSION,
    events_wired: WIRED_EVENTS,
    popularity_status: ANALYTICS_MATURITY.liveEventsEnabled ? "LIVE" : "INSUFFICIENT_DATA",
    trending_status: ANALYTICS_MATURITY.liveEventsEnabled ? "LIVE" : "INSUFFICIENT_DATA",
    minimum_events_for_trending: ANALYTICS_MATURITY.minimumEventsForTrending,
    anti_abuse_enabled: true,
    errors,
    warnings,
  };
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase18ManifestPath(rootDir), manifest);
  return { manifest };
}
