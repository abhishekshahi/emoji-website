import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { EXPECTED_KAOMOJI } from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const EDITORIAL = join(rootDir, "data/kaomoji/processed/phase-12/public-quality/editorial.json");

function fetchD1Ids(): Set<string> {
  const out = execSync(
    'npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "SELECT canonical_id FROM kaomoji WHERE is_public = 1;"',
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: rootDir },
  );
  return new Set([...out.matchAll(/kao_[0-9a-f]{16}/g)].map((m) => m[0]));
}

function main(): void {
  if (!process.argv.includes("--remote")) {
    console.error("Use --remote");
    process.exit(1);
  }

  const editorial = JSON.parse(readFileSync(EDITORIAL, "utf8")) as Array<{ canonical_id: string; is_public: boolean }>;
  const expected = new Set(
    editorial.filter((r) => r.is_public).map((r) => r.canonical_id),
  );
  const d1Ids = fetchD1Ids();

  const missing = [...expected].filter((id) => !d1Ids.has(id));
  const unexpected = [...d1Ids].filter((id) => !expected.has(id));
  const errors: string[] = [];
  if (d1Ids.size !== EXPECTED_KAOMOJI) errors.push(`D1 public count ${d1Ids.size} != ${EXPECTED_KAOMOJI}`);
  if (missing.length) errors.push(`missing IDs: ${missing.length} (e.g. ${missing.slice(0, 3).join(", ")})`);
  if (unexpected.length) errors.push(`unexpected IDs: ${unexpected.length} (e.g. ${unexpected.slice(0, 3).join(", ")})`);

  const report = {
    timestamp: new Date().toISOString(),
    d1_public_count: d1Ids.size,
    expected_public_count: expected.size,
    missing_count: missing.length,
    unexpected_count: unexpected.length,
    missing_sample: missing.slice(0, 20),
    unexpected_sample: unexpected.slice(0, 20),
    valid: errors.length === 0,
    errors,
  };

  mkdirSync(getPhase19RootDir(rootDir), { recursive: true });
  writeFileSync(join(getPhase19RootDir(rootDir), "canonical-id-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

main();
