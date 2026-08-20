import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  isImportComplete,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const pollMs = Number(process.env.PHASE19_WAIT_INTERVAL_MS ?? 120_000);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd: string, args: string[]): number {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
  return r.status ?? 1;
}

async function waitForD1(): Promise<void> {
  console.log("Waiting for D1 import gate:", EXPECTED_KAOMOJI, "kaomoji,", EXPECTED_RELATIONSHIPS, "relationships");
  while (!isImportComplete(rootDir, true)) {
    const k = queryCount(rootDir, "kaomoji", true);
    const r = queryCount(rootDir, "relationship", true);
    console.log(new Date().toISOString(), "kaomoji=", k, "relationships=", r);
    await sleep(pollMs);
  }
  console.log("D1 import gate PASSED");
}

async function main(): Promise<void> {
  await waitForD1();

  if (run("npx", ["tsx", "scripts/kaomoji/phase19-integrity-audit.ts", "--remote"]) !== 0) process.exit(1);
  if (run("npx", ["tsx", "scripts/kaomoji/phase19-validate-d1.ts", "--remote"]) !== 0) process.exit(1);
  if (run("npm", ["run", "kaomoji:phase19-verify-r2", "--", "--remote"]) !== 0) process.exit(1);
  if (run("npm", ["run", "kaomoji:phase19-recovery-reports", "--", "--remote"]) !== 0) process.exit(1);
  if (run("npm", ["run", "typecheck"]) !== 0) process.exit(1);
  if (run("npx", ["tsx", "--test", "src/lib/kaomoji/kaomoji-phase19.test.ts"]) !== 0) process.exit(1);
  if (run("npm", ["run", "build"]) !== 0) process.exit(1);

  console.log("Phase 19 complete — see r2-export/PHASE-19-FINAL.md");
}

void main();
