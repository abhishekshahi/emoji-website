import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19RootDir } from "@/lib/kaomoji/storage/paths";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  const remote = process.argv.includes("--remote");
  const kaomoji = queryCount(rootDir, "kaomoji", remote);
  const relationships = queryCount(rootDir, "relationship", remote);
  const category = queryCount(rootDir, "category", remote);
  const keyword = queryCount(rootDir, "keyword", remote);
  const collection = queryCount(rootDir, "collection", remote);

  const rawSha = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const errors: string[] = [];
  if (kaomoji !== EXPECTED_KAOMOJI) errors.push(`kaomoji count ${kaomoji} != ${EXPECTED_KAOMOJI}`);
  if (relationships !== EXPECTED_RELATIONSHIPS) {
    errors.push(`relationship count ${relationships} != ${EXPECTED_RELATIONSHIPS}`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    remote,
    counts: { kaomoji, relationships, category, keyword, collection },
    expected: { kaomoji: EXPECTED_KAOMOJI, relationships: EXPECTED_RELATIONSHIPS },
    raw_sha256: rawSha,
    valid: errors.length === 0,
    errors,
  };

  const out = join(getPhase19RootDir(rootDir), "d1-validation-report.json");
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

main();
