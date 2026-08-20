import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  EXPECTED_TABLE_COUNTS,
  IMPORT_TABLE_ORDER,
  isPhase19D1FullyComplete,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const pollMs = Number(process.env.PHASE19_FINALIZE_POLL_MS ?? 120_000);
const maxRetries = Number(process.env.PHASE19_FINALIZE_MAX_RETRIES ?? 5);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd: string, args: string[]): number {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
  return r.status ?? 1;
}

function isImportProcessRunning(): boolean {
  try {
    const lockPath = join(rootDir, "data", "kaomoji", "processed", "phase-19", "d1-import.lock");
    if (existsSync(lockPath)) return true;
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'phase19-import-d1|phase19-relationship-batches|phase19-import-relationships-fast' } | Select-Object -ExpandProperty ProcessId"`,
        { encoding: "utf8", cwd: rootDir },
      );
      return out.trim().length > 0;
    }
    const out = execSync("pgrep -f 'phase19-import-d1|phase19-relationship-batches|phase19-import-relationships-fast' || true", { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function logTableGaps(): string {
  const parts: string[] = [];
  for (const table of IMPORT_TABLE_ORDER) {
    const c = queryCount(rootDir, table, true);
    const exp = EXPECTED_TABLE_COUNTS[table];
    if (c !== exp) parts.push(`${table}=${c ?? "?"}/${exp}`);
  }
  return parts.join(" ");
}

async function waitForD1(): Promise<void> {
  console.log(
    "Phase 19 finalize — waiting for full D1 import:",
    EXPECTED_KAOMOJI,
    "kaomoji,",
    EXPECTED_RELATIONSHIPS,
    "relationships + remaining tables",
  );

  while (!isPhase19D1FullyComplete(rootDir, true)) {
    console.log(new Date().toISOString(), logTableGaps());

    if (isImportProcessRunning()) {
      console.log("Live importer detected — waiting (no second writer)");
      await sleep(pollMs);
      continue;
    }

    console.log("No live importer — safe sequential resume for gap repair");
    const code = spawnSync("npm", ["run", "kaomoji:phase19-import-d1", "--", "--remote", "--resume"], {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, PHASE19_D1_OR_IGNORE: "1", PHASE19_D1_BATCH_SLEEP_MS: "0" },
    }).status ?? 1;
    if (code !== 0) {
      console.warn("Resume pass exited", code, "— will retry after backoff");
      await sleep(Math.min(60_000, pollMs));
    } else {
      await sleep(10_000);
    }
  }

  console.log("Full D1 import gate PASSED");
}

async function runStepWithRetry(cmd: string, args: string[]): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (run(cmd, args) === 0) return true;
    const backoff = Math.min(60_000, 2000 * attempt);
    console.warn(`Step failed (attempt ${attempt}/${maxRetries}), backoff ${backoff}ms`);
    await sleep(backoff);
  }
  return false;
}

async function main(): Promise<void> {
  await waitForD1();

  const steps: Array<[string, string[]]> = [
    ["npx", ["tsx", "scripts/kaomoji/phase19-integrity-audit.ts", "--remote"]],
    ["npx", ["tsx", "scripts/kaomoji/phase19-canonical-audit.ts", "--remote"]],
    ["npx", ["tsx", "scripts/kaomoji/phase19-validate-d1.ts", "--remote"]],
    ["npm", ["run", "kaomoji:phase19-verify-r2", "--", "--remote"]],
    ["npm", ["run", "typecheck"]],
    ["npx", ["tsx", "--test", "src/lib/kaomoji/kaomoji-phase19.test.ts"]],
    ["npm", ["run", "build"]],
    ["npm", ["run", "build:cf"]],
    ["npm", ["run", "deploy:cf"]],
    ["npx", ["tsx", "scripts/kaomoji/phase19-worker-smoke.ts"]],
    ["npm", ["run", "kaomoji:phase19-recovery-reports", "--", "--remote"]],
  ];

  for (const [cmd, args] of steps) {
    if (!(await runStepWithRetry(cmd, args))) {
      console.error("Phase 19 finalize halted at:", cmd, args.join(" "));
      process.exit(1);
    }
  }

  console.log("PHASE 19 COMPLETE — PASS");
  console.log("Review r2-export/PHASE-19-FINAL.md");
}

void main();
