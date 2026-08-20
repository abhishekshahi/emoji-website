#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

const steps = [
  ["npx", ["tsx", "scripts/kaomoji/phase19-integrity-audit.ts", "--remote"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-canonical-audit.ts", "--remote"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-validate-d1.ts", "--remote"]],
  ["npm", ["run", "deploy:cf"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-worker-smoke.ts"]],
  ["npm", ["run", "kaomoji:phase19-recovery-reports", "--", "--remote"]],
];

for (const [cmd, args] of steps) run(cmd, args);
console.log("PHASE 19 COMPLETE — PASS");
