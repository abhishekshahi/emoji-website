import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferCheckpointFromRemote,
  getCheckpointPath,
  saveCheckpoint,
  queryCount,
  EXPECTED_KAOMOJI,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

const checkpoint = inferCheckpointFromRemote(rootDir, true);
if (!checkpoint) {
  console.error("Could not infer checkpoint from remote counts");
  console.error("kaomoji=", queryCount(rootDir, "kaomoji", true), "expected", EXPECTED_KAOMOJI);
  process.exit(1);
}

saveCheckpoint(rootDir, checkpoint);
console.log("Repaired checkpoint:");
console.log(JSON.stringify(checkpoint, null, 2));
