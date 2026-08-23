import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  D1_COUNT_PUBLIC_KAOMOJI,
  D1_GET_KAOMOJI_BY_SLUG,
  D1_GET_RELATED_KAOMOJI,
  D1_SEARCH_BY_CONTENT,
  D1_SEARCH_BY_KEYWORD,
} from "@/lib/kaomoji/cloudflare/d1-queries";
import {
  kaomojiCollectionsCacheHeaders,
  kaomojiDetailCacheHeaders,
  kaomojiSearchCacheHeaders,
} from "@/lib/kaomoji/cloudflare/cache";
import {
  KAOMOJI_SEARCH_RATE_LIMIT,
  checkKaomojiSearchRateLimit,
  resetKaomojiSearchRateLimits,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getPhase14SearchIndexPath } from "../../storage/paths";

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]+/,
  /CLOUDFLARE_API_TOKEN\s*=\s*['"][^'"]+['"]/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

export function auditParameterizedQueries(): boolean {
  const userInputQueries = [
    D1_GET_KAOMOJI_BY_SLUG,
    D1_GET_RELATED_KAOMOJI,
    D1_SEARCH_BY_KEYWORD,
    D1_SEARCH_BY_CONTENT,
  ];
  return userInputQueries.every((q) => /\?\d+/.test(q) && !/\$\{/.test(q));
}

export function auditRateLimit(): boolean {
  resetKaomojiSearchRateLimits();
  const key = "phase20-audit";
  for (let i = 0; i < KAOMOJI_SEARCH_RATE_LIMIT; i++) {
    if (!checkKaomojiSearchRateLimit(key)) return false;
  }
  return !checkKaomojiSearchRateLimit(key);
}

export function auditSearchSanitization(): boolean {
  const ctrl = sanitizeSearchRequest("\x07bad", 24, 0);
  const ok = sanitizeSearchRequest("anime", 24, 0);
  const capped = sanitizeSearchRequest("test", 999, 99999);
  return ctrl.rejected && !ok.rejected && ok.limit <= 48 && capped.offset <= 10000;
}

export function auditCacheHeaders(): boolean {
  const search = kaomojiSearchCacheHeaders()["Cache-Control"];
  const detail = kaomojiDetailCacheHeaders()["Cache-Control"];
  const collections = kaomojiCollectionsCacheHeaders()["Cache-Control"];
  return Boolean(search && detail && collections);
}

export function countSchemaIndexes(rootDir: string): number {
  const schema = readFileSync(join(rootDir, "migrations/kaomoji/0001_schema.sql"), "utf8");
  return (schema.match(/CREATE INDEX IF NOT EXISTS/gi) ?? []).length;
}

export function auditNoSecretsInClient(rootDir: string): boolean {
  const dirs = [join(rootDir, "src/app"), join(rootDir, "src/components")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of walkFiles(dir, [".ts", ".tsx"])) {
      const text = readFileSync(file, "utf8");
      if (SECRET_PATTERNS.some((p) => p.test(text))) return false;
    }
  }
  return true;
}

export function auditSearchBenchmark(rootDir: string): { pass: boolean; score: string } {
  const idx = JSON.parse(readFileSync(getPhase14SearchIndexPath(rootDir), "utf8"));
  const result = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
  return { pass: result.pass === result.total, score: `${result.pass}/${result.total}` };
}

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

export function auditKaomojiRoutes(rootDir: string): number {
  const app = join(rootDir, "src/app");
  if (!existsSync(app)) return 0;
  return walkFiles(app, [".tsx"]).filter((f) => f.includes(`${join("app", "kaomoji")}`)).length;
}

export function auditReducedMotion(rootDir: string): boolean {
  const css = join(rootDir, "src/app/globals.css");
  if (!existsSync(css)) return false;
  const text = readFileSync(css, "utf8");
  return text.includes("prefers-reduced-motion");
}
