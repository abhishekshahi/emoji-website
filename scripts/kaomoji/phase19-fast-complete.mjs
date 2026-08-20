#!/usr/bin/env node
/** Poll until D1 full, then run remaining Phase 19 gates fast. Single writer safe. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pollMs = Number(process.env.PHASE19_FAST_POLL_MS ?? 30_000);
const lockPath = join(rootDir, "data/kaomoji/processed/phase-19/d1-import.lock");

const EXPECTED = {
  category: 56,
  keyword: 998,
  kaomoji: 50979,
  kaomoji_category: 131314,
  kaomoji_keyword: 383621,
  collection: 20,
  collection_item: 4400,
  relationship: 392904,
  search_metadata: 4,
  kaomoji_locale: 198942,
  source_attribution: 60165,
  production_release: 1,
};

function run(cmd, args, env = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  return r.status ?? 1;
}

function queryCount(table) {
  const tsx = join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(
    process.execPath,
    [
      tsx,
      "-e",
      `import {queryCount} from './src/lib/kaomoji/cloudflare/d1-import.ts'; console.log('COUNT', queryCount('${rootDir.replace(/\\/g, "/")}', '${table}', true) ?? 'null');`,
    ],
    { cwd: rootDir, encoding: "utf8" },
  );
  const m = (r.stdout ?? "").match(/COUNT\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

function isFull() {
  for (const [t, exp] of Object.entries(EXPECTED)) {
    const c = queryCount(t);
    if (c !== exp) {
      console.log(new Date().toISOString(), `${t}=${c ?? "?"}/${exp}`);
      return false;
    }
  }
  return true;
}

function importRunning() {
  if (existsSync(lockPath)) return true;
  try {
    const out = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'phase19-import-d1' } | Measure-Object | Select-Object -ExpandProperty Count",
      ],
      { cwd: rootDir, encoding: "utf8" },
    );
    return Number(out.stdout?.trim()) > 0;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log("Phase 19 fast-complete watcher started");
while (!isFull()) {
  if (!importRunning()) {
    console.log("No live importer — resuming OR-IGNORE gap fill");
    const code = run("npm", ["run", "kaomoji:phase19-import-d1", "--", "--remote", "--resume"], {
      PHASE19_D1_OR_IGNORE: "1",
      PHASE19_D1_BATCH_SLEEP_MS: "0",
      PHASE19_D1_COMPACT_CHECKPOINT: "1",
    });
    if (code !== 0) await sleep(5000);
    continue;
  }
  await sleep(pollMs);
}

console.log("D1 FULL — running validation pipeline");
const steps = [
  ["npx", ["tsx", "scripts/kaomoji/phase19-integrity-audit.ts", "--remote"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-canonical-audit.ts", "--remote"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-validate-d1.ts", "--remote"]],
  ["npm", ["run", "build:cf"]],
  ["npm", ["run", "deploy:cf"]],
  ["npx", ["tsx", "scripts/kaomoji/phase19-worker-smoke.ts"]],
  ["npm", ["run", "kaomoji:phase19-recovery-reports", "--", "--remote"]],
];

for (const [cmd, args] of steps) {
  if (run(cmd, args) !== 0) {
    console.error("FAILED:", cmd, args.join(" "));
    process.exit(1);
  }
}

console.log("PHASE 19 COMPLETE — PASS");
process.exit(0);
