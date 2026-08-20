import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  isImportComplete,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const logPath = join(rootDir, "phase19-d1-progress.log");
const legacyPid = Number(process.env.PHASE19_LEGACY_PID ?? 16040);

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(logPath, line, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runResumeImport(): Promise<number> {
  return new Promise((resolve) => {
    log("Starting npm run kaomoji:phase19-import-d1 -- --remote --resume");
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "kaomoji:phase19-import-d1", "--", "--remote", "--resume"],
      { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  log(`Watcher started (legacy pid ${legacyPid})`);
  while (pidAlive(legacyPid)) {
    const k = queryCount(rootDir, "kaomoji", true);
    log(`legacy-active kaomoji=${k ?? "?"}`);
    if (isImportComplete(rootDir, true)) {
      log("Import complete while legacy still marked alive");
      process.exit(0);
    }
    await sleep(120_000);
  }

  log("Legacy import process exited");
  if (isImportComplete(rootDir, true)) {
    log(`COMPLETE ${EXPECTED_KAOMOJI} kaomoji ${EXPECTED_RELATIONSHIPS} relationships`);
    process.exit(0);
  }

  let attempt = 0;
  while (!isImportComplete(rootDir, true)) {
    attempt++;
    log(`Resume attempt ${attempt}`);
    const code = await runResumeImport();
    log(`Resume exited code ${code}`);
    if (isImportComplete(rootDir, true)) {
      log("COMPLETE after resume");
      process.exit(0);
    }
    const backoff = Math.min(120_000, 10_000 * attempt);
    log(`Backoff ${backoff}ms`);
    await sleep(backoff);
  }
  process.exit(0);
}

void main();
