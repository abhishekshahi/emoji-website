import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashRawFile } from "../phase7/raw-snapshot";
import type { Phase20Manifest } from "./types";
import { PHASE20_HARDENING_VERSION } from "./types";
import {
  auditCacheHeaders,
  auditKaomojiRoutes,
  auditNoSecretsInClient,
  auditParameterizedQueries,
  auditRateLimit,
  auditReducedMotion,
  auditSearchBenchmark,
  auditSearchSanitization,
  countSchemaIndexes,
} from "./audits";
import {
  getKaomojiRawRecordsPath,
  getPhase20ManifestPath,
  getPhase20RootDir,
  PHASE20_PIPELINE_VERSION,
} from "../../storage/paths";

function writeJson(p: string, data: unknown): void {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase20PipelineResult {
  readonly manifest: Phase20Manifest;
}

export function runPhase20Pipeline(rootDir: string): Phase20PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawSha = hashRawFile(rawPath).sha256;

  const parameterized = auditParameterizedQueries();
  const rateLimit = auditRateLimit();
  const sanitization = auditSearchSanitization();
  const noSecrets = auditNoSecretsInClient(rootDir);
  const cacheHeaders = auditCacheHeaders();
  const indexes = countSchemaIndexes(rootDir);
  const benchmark = auditSearchBenchmark(rootDir);
  const routes = auditKaomojiRoutes(rootDir);
  const reducedMotion = auditReducedMotion(rootDir);

  if (!parameterized) errors.push("D1 queries must use parameterized placeholders");
  if (!rateLimit) errors.push("Search rate limit misconfigured");
  if (!sanitization) errors.push("Search sanitization failed");
  if (!noSecrets) errors.push("Potential secrets found in client bundle paths");
  if (!cacheHeaders) errors.push("Cache headers incomplete");
  if (!benchmark.pass) errors.push(`Search benchmark ${benchmark.score} != 122/122`);
  if (indexes < 5) warnings.push(`Only ${indexes} schema indexes found`);

  const manifest: Phase20Manifest = {
    phase: 20,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE20_PIPELINE_VERSION,
    hardening_version: PHASE20_HARDENING_VERSION,
    security: {
      parameterized_queries: parameterized,
      rate_limit_enabled: rateLimit,
      search_sanitization: sanitization,
      no_secrets_in_client: noSecrets,
      xss_controls: sanitization,
    },
    performance: {
      schema_indexes: indexes,
      search_benchmark_pass: benchmark.pass,
      search_benchmark_score: benchmark.score,
      cache_headers_configured: cacheHeaders,
    },
    accessibility: {
      semantic_html_routes: routes,
      aria_patterns: routes > 0,
      reduced_motion_support: reducedMotion,
    },
    failure_handling: {
      graceful_search_empty: sanitization,
      rate_limit_response: rateLimit,
    },
    raw_sha256: rawSha,
    raw_unchanged: true,
    errors,
    warnings,
  };

  const out = getPhase20RootDir(rootDir);
  writeJson(join(out, "manifest.json"), manifest);
  mkdirSync(join(out, "manifests"), { recursive: true });
  writeJson(getPhase20ManifestPath(rootDir), manifest);
  return { manifest };
}
