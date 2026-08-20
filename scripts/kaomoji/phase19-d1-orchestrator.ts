import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  getImportLockPath,
  getImportLogPath,
  isImportComplete,
  queryCount,
  queryDuplicateCanonicalIds,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const pollMs = Number(process.env.PHASE19_ORCH_POLL_MS ?? 120_000);
const stallPolls = Number(process.env.PHASE19_ORCH_STALL_POLLS ?? 3);
const maxRetries = Number(process.env.PHASE19_ORCH_MAX_RETRIES ?? 9999);

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(getImportLogPath(rootDir), line, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readLock(): { pid: number; started_at: string } | null {
  const p = getImportLockPath(rootDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as { pid: number; started_at: string };
  } catch {
    return null;
  }
}

function isImportProcessRunning(): boolean {
  try {
    if (process.platform === "win32") {
      const out = require("node:child_process").execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'phase19-import-d1' } | Select-Object -ExpandProperty ProcessId"`,
        { encoding: "utf8" },
      );
      return out.trim().length > 0;
    }
    const out = require("node:child_process").execSync("pgrep -f phase19-import-d1 || true", { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function lockProcessAlive(lock: { pid: number }): boolean {
  try {
    process.kill(lock.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runImportResume(): Promise<number> {
  return new Promise((resolve) => {
    log("Starting sequential import --remote --resume");
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "kaomoji:phase19-import-d1", "--", "--remote", "--resume"],
      { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  log("Phase 19 D1 orchestrator started (concurrency=1, no parallel imports)");
  let lastRel = -1;
  let stallCount = 0;
  let retries = 0;

  while (retries < maxRetries) {
    const kaomoji = queryCount(rootDir, "kaomoji", true);
    const rel = queryCount(rootDir, "relationship", true);
    const dupes = queryDuplicateCanonicalIds(rootDir, true);

    log(`status kaomoji=${kaomoji ?? "?"} rel=${rel ?? "?"} dupes=${dupes ?? "?"} retries=${retries}`);

    if (dupes !== null && dupes > 0) {
      log(`ERROR: ${dupes} duplicate canonical IDs — manual review required before resume`);
      process.exit(2);
    }

    if (isImportComplete(rootDir, true)) {
      log(`COMPLETE: ${EXPECTED_KAOMOJI} kaomoji, ${EXPECTED_RELATIONSHIPS} relationships`);
      process.exit(0);
    }

    const lock = readLock();
    const relRising = rel !== null && lastRel >= 0 && rel > lastRel;
    lastRel = rel ?? lastRel;

    if (relRising || isImportProcessRunning()) {
      stallCount = 0;
      log("Import appears active (relationship count rising or process running) — waiting");
      await sleep(pollMs);
      continue;
    }

    if (lock && lockProcessAlive(lock)) {
      stallCount = 0;
      log(`Import lock held by live pid ${lock.pid} — waiting`);
      await sleep(pollMs);
      continue;
    }

    if (lock && !lockProcessAlive(lock)) {
      log("Removing orphan import lock (pid not running)");
      try {
        unlinkSync(getImportLockPath(rootDir));
      } catch {
        /* ignore */
      }
    }

    stallCount++;
    if (stallCount < stallPolls) {
      log(`Stall watch ${stallCount}/${stallPolls} — not starting import yet`);
      await sleep(pollMs);
      continue;
    }

    stallCount = 0;
    retries++;
    const backoff = Math.min(60_000, 5000 * retries);
    if (backoff > 0) {
      log(`Backoff ${backoff}ms before retry ${retries}`);
      await sleep(backoff);
    }

    const code = await runImportResume();
    log(`Import process exited with code ${code}`);
    if (code === 0) {
      if (isImportComplete(rootDir, true)) process.exit(0);
    }
    await sleep(pollMs);
  }

  log("Max retries exceeded");
  process.exit(1);
}

void main();
