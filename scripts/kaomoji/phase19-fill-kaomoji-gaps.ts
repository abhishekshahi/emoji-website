import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSqlFiles,
  executeSqlWithRetry,
  EXPECTED_KAOMOJI,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19ExportDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  const d1Dir = join(getPhase19ExportDir(rootDir), "d1");
  const files = collectSqlFiles(d1Dir, "kaomoji");
  const before = queryCount(rootDir, "kaomoji", true);
  console.log("Kaomoji before:", before, "target:", EXPECTED_KAOMOJI);

  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (i % 50 === 0 || i === files.length - 1) {
      console.log(`  batch ${i + 1}/${files.length}`);
    }
    const result = await executeSqlWithRetry(rootDir, file, true);
    if (result.ok) ok++;
  }

  const after = queryCount(rootDir, "kaomoji", true);
  console.log("Kaomoji after:", after, "batches ok:", ok);
  process.exit(after === EXPECTED_KAOMOJI ? 0 : 1);
}

void main();
